import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChatBubbleLeftRightIcon, XMarkIcon, PaperAirplaneIcon, PaperClipIcon, CubeTransparentIcon } from "@heroicons/react/24/outline";
import { colors, fontSans, fontSerif } from "../lib/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const TRELLIS_API = "https://api.trellisxr.microsoft.com/v1"; // swap with real endpoint when live
const BOT_INTRO = "Hi! I can convert any furniture photo into a 3D model you can view in AR. Drop an image or PDF, or just describe what you're looking for.";

// ─── LangGraph node definitions ───────────────────────────────────────────────
// This is a frontend-side LangGraph-style state machine. Each node receives
// the current graph state, does its work (possibly calling the Claude API
// or the Trellis API), and returns a partial state update + the next node.
// The run() function drives the graph forward until a node returns next=null.

async function nodeClassifyIntent(state) {
  // If there is a pending file, the intent is always "convert"
  if (state.pendingFile) return { intent: "convert", next: "convertImage" };

  // Otherwise ask the LLM to classify the user's text message
  const resp = await callClaude([
    { role: "system", content: `You are a router for a furniture AR assistant.
Classify the user message into ONE of these intents and respond with ONLY the intent word:
- convert (user wants to create/see a 3D model from an image they already uploaded, or wants changes to the current model)
- ask (general question about furniture, materials, sizing, style)
- resize (user wants to change the size of the current model)
- recolor (user wants to change the color of the current model)` },
    { role: "user", content: state.lastUserMsg },
  ]);

  const intent = resp.trim().toLowerCase();
  const nextMap = { convert:"convertImage", ask:"answerQuestion", resize:"resizeModel", recolor:"recolorModel" };
  return { intent, next: nextMap[intent] || "answerQuestion" };
}

async function nodeConvertImage(state) {
  if (!state.pendingFile && !state.currentImageB64) {
    return { assistantMsg: "Please drop an image first so I can convert it to a 3D model.", next: null };
  }

  // 1. If there's a brand-new file, upload it to Trellis
  let modelUrl = state.currentModelUrl;
  let imageB64 = state.currentImageB64;

  if (state.pendingFile) {
    // Convert file to base64
    imageB64 = await fileToBase64(state.pendingFile);

    // Extract user's modification instructions (if any message alongside the drop)
    const instructions = state.lastUserMsg
      ? `Apply these user instructions: ${state.lastUserMsg}`
      : "";

    // Call Trellis — POST with the image + optional instructions
    const trellisResp = await callTrellis(imageB64, instructions);
    modelUrl = trellisResp.model_url; // .glb URL returned by Trellis
  } else {
    // User is asking for changes to the existing model — re-call Trellis with instructions
    const trellisResp = await callTrellis(imageB64, state.lastUserMsg);
    modelUrl = trellisResp.model_url;
  }

  return {
    currentModelUrl: modelUrl,
    currentImageB64: imageB64,
    pendingFile: null,
    arModelUrl: modelUrl,
    assistantMsg: 'Here\'s your 3D model! Tap "View in AR" to place it in your room. You can also describe any changes you\'d like — for example "make it more modern" or "change the legs to metal".',
    next: null,
  };
}

async function nodeAnswerQuestion(state) {
  // Build a conversation history the LLM can use
  const history = state.messages
    .filter(m => m.role !== "system")
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content }));

  history.push({ role:"user", content: state.lastUserMsg });

  const answer = await callClaude([
    { role:"system", content:"You are a helpful furniture and interior design assistant for Atelier Oak, a luxury furniture brand. Be concise and friendly." },
    ...history,
  ]);

  return { assistantMsg: answer, next: null };
}

async function nodeResizeModel(state) {
  if (!state.currentModelUrl) {
    return { assistantMsg:"No model loaded yet. Please drop a furniture image first.", next:null };
  }
  // Ask Claude to extract dimension intent, then inform the user — actual
  // model scaling is handled in the AR viewer via the size sliders.
  const answer = await callClaude([
    { role:"system", content:"Extract resize instructions from the user message and reply with a friendly instruction telling the user to use the Width/Height/Length sliders visible in the AR overlay (or below the 3D viewer on iPhone) to adjust the size. Mention the direction they want and be brief." },
    { role:"user", content: state.lastUserMsg },
  ]);
  return { assistantMsg: answer, next:null };
}

async function nodeRecolorModel(state) {
  if (!state.currentModelUrl) {
    return { assistantMsg:"No model loaded yet. Please drop a furniture image first.", next:null };
  }
  const answer = await callClaude([
    { role:"system", content:"Extract color instructions from the user message and reply with a friendly instruction telling the user to use the Color tab (the RGB wheel) visible in the AR panel. Name the color they want and be brief." },
    { role:"user", content: state.lastUserMsg },
  ]);
  return { assistantMsg: answer, next:null };
}

const NODES = {
  classifyIntent: nodeClassifyIntent,
  convertImage:   nodeConvertImage,
  answerQuestion: nodeAnswerQuestion,
  resizeModel:    nodeResizeModel,
  recolorModel:   nodeRecolorModel,
};

// ─── Graph runner ─────────────────────────────────────────────────────────────
async function runGraph(initialState) {
  let state = { ...initialState, next: "classifyIntent" };
  const MAX_HOPS = 6;
  let hops = 0;

  while (state.next && hops < MAX_HOPS) {
    const node = NODES[state.next];
    if (!node) break;
    const update = await node(state);
    state = { ...state, ...update };
    hops++;
  }
  return state;
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function callClaude(messages) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages,
    }),
  });
  const data = await resp.json();
  return data.content?.find(b => b.type === "text")?.text || "";
}

async function callTrellis(imageB64, instructions = "") {
  // Replace this stub with your real Microsoft Trellis API call.
  // Expected request: POST /generate with { image_base64, instructions }
  // Expected response: { model_url: "https://...something.glb" }
  //
  // Uncomment and fill in when you have a real API key:
  //
  // const resp = await fetch(`${TRELLIS_API}/generate`, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     "Ocp-Apim-Subscription-Key": import.meta.env.VITE_TRELLIS_API_KEY,
  //   },
  //   body: JSON.stringify({ image_base64: imageB64, instructions }),
  // });
  // const data = await resp.json();
  // return { model_url: data.model_url };

  // ── Stub: returns Google's sample model so you can test the full flow ──
  await new Promise(r => setTimeout(r, 2200)); // simulate network latency
  return { model_url: "https://modelviewer.dev/shared-assets/models/Astronaut.glb" };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isImageFile(file) {
  return file.type.startsWith("image/");
}
function isPdfFile(file) {
  return file.type === "application/pdf";
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CHAT_STYLES = `
  .aoc-btn{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:#3C2A1E;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(60,42,30,0.35);z-index:9000;transition:transform 0.15s;}
  .aoc-btn:hover{transform:scale(1.08);}
  .aoc-drawer{position:fixed;bottom:88px;right:24px;width:360px;max-height:600px;display:flex;flex-direction:column;background:#fff;border:1.5px solid #E4DBC9;border-radius:16px;box-shadow:0 8px 40px rgba(60,42,30,0.18);z-index:9001;overflow:hidden;font-family:'Inter',sans-serif;}
  @media(max-width:420px){.aoc-drawer{right:0;bottom:0;width:100vw;max-height:85vh;border-radius:16px 16px 0 0;}}
  .aoc-header{padding:14px 16px;background:#3C2A1E;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .aoc-title{font-family:'Fraunces','Georgia',serif;font-size:15px;font-weight:500;}
  .aoc-close{background:none;border:none;cursor:pointer;color:#fff;display:flex;padding:2px;}
  .aoc-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;}
  .aoc-msg{max-width:86%;padding:10px 13px;border-radius:12px;font-size:13px;line-height:1.55;}
  .aoc-msg.user{align-self:flex-end;background:#3C2A1E;color:#fff;border-bottom-right-radius:3px;}
  .aoc-msg.assistant{align-self:flex-start;background:#F3EDE1;color:#2B241D;border-bottom-left-radius:3px;}
  .aoc-msg.system{align-self:center;background:transparent;color:#6E6355;font-size:12px;text-align:center;}
  .aoc-typing{display:flex;gap:4px;padding:10px 13px;background:#F3EDE1;border-radius:12px;border-bottom-left-radius:3px;width:fit-content;}
  .aoc-dot{width:7px;height:7px;border-radius:50%;background:#8A5A34;animation:aoc-bounce 1.2s ease-in-out infinite;}
  .aoc-dot:nth-child(2){animation-delay:0.2s;}
  .aoc-dot:nth-child(3){animation-delay:0.4s;}
  @keyframes aoc-bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}
  .aoc-drop-zone{margin:0 16px 12px;border:1.5px dashed #CFAE89;border-radius:10px;padding:14px;text-align:center;font-size:12px;color:#8A5A34;cursor:pointer;transition:background 0.15s;background:rgba(207,174,137,0.07);}
  .aoc-drop-zone.drag-over{background:rgba(207,174,137,0.2);}
  .aoc-preview{width:100%;border-radius:6px;max-height:120px;object-fit:cover;margin-top:8px;}
  .aoc-footer{padding:10px 12px;border-top:1px solid #E4DBC9;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;}
  .aoc-input{flex:1;padding:9px 12px;font-size:13px;font-family:'Inter',sans-serif;border:1.5px solid #E4DBC9;border-radius:8px;outline:none;resize:none;line-height:1.4;max-height:100px;color:#2B241D;}
  .aoc-send{padding:9px 14px;background:#3C2A1E;color:#fff;border:none;cursor:pointer;border-radius:8px;display:flex;align-items:center;flex-shrink:0;}
  .aoc-send:disabled{opacity:0.45;cursor:not-allowed;}
  .aoc-attach{background:none;border:none;cursor:pointer;color:#8A5A34;display:flex;padding:9px 6px;}
  .aoc-ar-preview{background:#F3EDE1;padding:12px;border-radius:10px;border:1px solid #E4DBC9;}
  .aoc-ar-btn{margin-top:10px;width:100%;padding:9px;background:#3C2A1E;color:#fff;border:none;cursor:pointer;border-radius:6px;font-size:13px;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;}
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function ARChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role:"assistant", content: BOT_INTRO }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);     // File object
  const [filePreview, setFilePreview] = useState(null);     // data URL for preview
  const [arModelUrl, setArModelUrl] = useState(null);       // .glb URL from Trellis
  const [graphState, setGraphState] = useState({
    messages: [],
    currentModelUrl: null,
    currentImageB64: null,
  });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  const addMsg = (role, content) =>
    setMessages(prev => [...prev, { role, content }]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!isImageFile(file) && !isPdfFile(file)) {
      addMsg("system", "Only images and PDFs are supported.");
      return;
    }
    setPendingFile(file);
    if (isImageFile(file)) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
    addMsg("system", `📎 ${file.name} attached — send a message or just press ↑ to convert.`);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const send = async () => {
    const text = input.trim();
    if (!text && !pendingFile) return;
    if (loading) return;

    const userMsg = text || (pendingFile ? `Convert: ${pendingFile.name}` : "");
    addMsg("user", userMsg);
    setInput("");
    setLoading(true);

    try {
      const newState = await runGraph({
        ...graphState,
        messages: [...graphState.messages, { role:"user", content:userMsg }],
        lastUserMsg: userMsg,
        pendingFile: pendingFile,
      });

      if (newState.assistantMsg) addMsg("assistant", newState.assistantMsg);
      if (newState.arModelUrl) setArModelUrl(newState.arModelUrl);

      setGraphState({
        messages: [...graphState.messages, { role:"user", content:userMsg }, { role:"assistant", content:newState.assistantMsg||"" }],
        currentModelUrl: newState.currentModelUrl || graphState.currentModelUrl,
        currentImageB64: newState.currentImageB64 || graphState.currentImageB64,
      });

      setPendingFile(null);
      setFilePreview(null);
    } catch(err) {
      console.error(err);
      addMsg("assistant", "Sorry, something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      <style>{CHAT_STYLES}</style>

      {/* Floating button */}
      <button className="aoc-btn" onClick={() => setOpen(o => !o)} aria-label="Open AR Chatbot">
        {open
          ? <XMarkIcon style={{ width:22, height:22 }} />
          : <ChatBubbleLeftRightIcon style={{ width:22, height:22 }} />}
      </button>

      {/* Drawer */}
      {open && (
        <div className="aoc-drawer">
          <div className="aoc-header">
            <span className="aoc-title">AR Design Assistant</span>
            <button className="aoc-close" onClick={() => setOpen(false)}>
              <XMarkIcon style={{ width:18, height:18 }} />
            </button>
          </div>

          {/* Messages */}
          <div className="aoc-messages">
            {messages.map((m, i) => (
              <div key={i} className={`aoc-msg ${m.role}`}>{m.content}</div>
            ))}
            {loading && (
              <div className="aoc-typing">
                <div className="aoc-dot" />
                <div className="aoc-dot" />
                <div className="aoc-dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Drop zone */}
          <div
            className={`aoc-drop-zone ${dragOver?"drag-over":""}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {filePreview
              ? <img src={filePreview} alt="preview" className="aoc-preview" />
              : pendingFile
              ? <span>📄 {pendingFile.name}</span>
              : <span>Drop a furniture photo or PDF here, or click to browse</span>}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display:"none" }}
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
            />
          </div>

          {/* AR model-viewer preview (appears once Trellis returns a model) */}
          {arModelUrl && (
            <div style={{ margin:"0 16px 12px" }}>
              <div className="aoc-ar-preview">
                <p style={{ fontSize:12, color:colors.textMuted, marginBottom:8, fontFamily:fontSans }}>
                  3D model ready — view it in your space:
                </p>
                <model-viewer
                  ref={viewerRef}
                  src={arModelUrl}
                  alt="Generated 3D furniture model"
                  ar
                  ar-modes="webxr scene-viewer quick-look"
                  camera-controls
                  auto-rotate
                  shadow-intensity="1"
                  style={{ width:"100%", height:180, borderRadius:8, display:"block", backgroundColor:colors.creamAlt }}
                >
                  <button slot="ar-button" className="aoc-ar-btn">
                    <CubeTransparentIcon style={{ width:16, height:16 }} />
                    View in your space
                  </button>
                </model-viewer>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="aoc-footer">
            <button className="aoc-attach" onClick={() => fileInputRef.current?.click()} aria-label="Attach file">
              <PaperClipIcon style={{ width:20, height:20 }} />
            </button>
            <textarea
              className="aoc-input"
              rows={1}
              placeholder={pendingFile ? "Describe any changes, or press send to convert…" : "Ask about furniture, drop an image…"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
            />
            <button className="aoc-send" onClick={send} disabled={loading || (!input.trim() && !pendingFile)} aria-label="Send">
              <PaperAirplaneIcon style={{ width:18, height:18 }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
