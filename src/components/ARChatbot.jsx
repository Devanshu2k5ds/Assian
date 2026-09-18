/**
 * ARChatbot.jsx
 *
 * Flow:
 *  1. User drops an image
 *  2. OpenAI gpt-4o classifies intent
 *      "convert"   → Trellis immediately
 *      "edit"      → Qwen image-edit → Trellis
 *  3. Trellis returns a .glb URL
 *  4. model-viewer renders it with AR button
 *  5. In-AR (Android WebXR): chatbot panel is rendered as a DOM overlay
 *     child of <model-viewer> so it floats over the camera feed.
 *     iOS Quick Look has no overlay API — panel stays on-page below viewer.
 *  6. User can keep chatting to re-edit → Qwen → Trellis → model swaps.
 *
 * ENV vars (add to .env at project root):
 *   VITE_OPENAI_API_KEY      — OpenAI key (gpt-4o for routing + vision)
 *   VITE_QWEN_API_KEY        — Alibaba Cloud Qwen key (image editing)
 *   VITE_TRELLIS_API_KEY     — Microsoft Trellis key (image → 3D)
 *   VITE_TRELLIS_ENDPOINT    — Trellis endpoint URL
 */

import React, {
  useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle
} from "react";
import {
  ChatBubbleLeftRightIcon, XMarkIcon,
  PaperAirplaneIcon, PaperClipIcon, CubeTransparentIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";
import { colors, fontSans, fontSerif } from "../lib/theme";

// ─── Env ──────────────────────────────────────────────────────────────────────
const OPENAI_KEY  = import.meta.env.VITE_OPENAI_API_KEY  || "";
const QWEN_KEY    = import.meta.env.VITE_QWEN_API_KEY    || "";
const TRELLIS_KEY = import.meta.env.VITE_TRELLIS_API_KEY || "";
const TRELLIS_URL = import.meta.env.VITE_TRELLIS_ENDPOINT|| "https://api.trellisxr.microsoft.com/v1";

// ─── API helpers ──────────────────────────────────────────────────────────────

/** OpenAI gpt-4o — text + optional vision (image as base64) */
async function callOpenAI(messages) {
  if (!OPENAI_KEY) {
    // stub — remove once you add VITE_OPENAI_API_KEY to .env
    await delay(400);
    const last = messages[messages.length - 1];
    const content = typeof last.content === "string" ? last.content : JSON.stringify(last.content);
    if (/color|paint|texture|style|change|edit|darker|lighter|wood|fabric/i.test(content)) return "edit";
    if (/convert|3d|model|ar|space/i.test(content)) return "convert";
    return "convert";
  }
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o", max_tokens: 600, messages }),
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

/**
 * Qwen VL image-edit.
 * Docs: https://help.aliyun.com/en/model-studio/qwen-vl
 * The edit endpoint expects a base64 image + a text instruction and returns
 * an edited base64 image.
 */
async function callQwenEdit(imageB64, instruction) {
  if (!QWEN_KEY) {
    // stub — returns the original image unchanged so the flow still runs
    await delay(1800);
    return imageB64;
  }
  const resp = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${QWEN_KEY}`,
        "X-DashScope-Async": "disable",
      },
      body: JSON.stringify({
        model: "wanx-v1",            // Qwen image-edit model — swap if Alibaba updates it
        input: {
          prompt: instruction,
          image_list: [`data:image/png;base64,${imageB64}`],
        },
        parameters: { n: 1, size: "1024*1024" },
      }),
    }
  );
  if (!resp.ok) throw new Error(`Qwen ${resp.status}`);
  const data = await resp.json();
  // Qwen returns an array of output images as URLs or base64
  const resultUrl = data.output?.results?.[0]?.url;
  if (!resultUrl) throw new Error("Qwen returned no image");
  // fetch the result image and re-encode as base64
  const imgResp = await fetch(resultUrl);
  const blob = await imgResp.blob();
  return blobToBase64(blob);
}

/**
 * Microsoft Trellis — image (base64) → .glb URL.
 * Trellis is async: POST to start, then poll until status = "succeeded".
 */
async function callTrellis(imageB64) {
  if (!TRELLIS_KEY) {
    // stub — returns Google's sample model so the full flow is testable now
    await delay(2400);
    return "https://modelviewer.dev/shared-assets/models/Astronaut.glb";
  }

  // 1. Kick off the job
  const startResp = await fetch(`${TRELLIS_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": TRELLIS_KEY,
    },
    body: JSON.stringify({ image_base64: imageB64, output_format: "glb" }),
  });
  if (!startResp.ok) throw new Error(`Trellis start ${startResp.status}`);
  const { job_id } = await startResp.json();

  // 2. Poll every 3 s, timeout after 3 min
  const deadline = Date.now() + 3 * 60_000;
  while (Date.now() < deadline) {
    await delay(3000);
    const pollResp = await fetch(`${TRELLIS_URL}/jobs/${job_id}`, {
      headers: { "Ocp-Apim-Subscription-Key": TRELLIS_KEY },
    });
    const poll = await pollResp.json();
    if (poll.status === "succeeded") return poll.result_url;   // .glb URL
    if (poll.status === "failed") throw new Error("Trellis job failed");
  }
  throw new Error("Trellis timed out");
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// ─── LangGraph-style state machine ───────────────────────────────────────────
/**
 * Graph state shape:
 * {
 *   history:        [{role, content}],   // full OpenAI message history
 *   sourceImageB64: string|null,         // original uploaded image (base64)
 *   editedImageB64: string|null,         // after Qwen edit (base64)
 *   modelUrl:       string|null,         // current .glb URL
 *   lastUserMsg:    string,
 *   pendingFile:    File|null,
 *   intent:         string|null,
 *   statusMsg:      string,              // shown in chat as progress
 *   error:          string|null,
 * }
 */

async function nodeRoute(state) {
  const { lastUserMsg, sourceImageB64, history } = state;

  // Build vision message if we have an image
  const userContent = sourceImageB64
    ? [
        { type: "image_url", image_url: { url: `data:image/png;base64,${sourceImageB64}` } },
        { type: "text", text: lastUserMsg || "Convert this to a 3D model." },
      ]
    : lastUserMsg;

  const systemPrompt = `You are a routing agent for a furniture AR app.
Given the conversation and (optionally) an image, reply with EXACTLY one word:
- "convert"  → user wants to create a 3D model from the current image without edits
- "edit"     → user wants to change color, material, texture, style, or any visual aspect of the image before converting
- "chat"     → general question, no image action needed`;

  const intent = await callOpenAI([
    { role: "system", content: systemPrompt },
    ...history.slice(-6),
    { role: "user", content: userContent },
  ]);

  const clean = intent.toLowerCase().replace(/[^a-z]/g, "");
  return {
    intent: clean === "edit" ? "edit" : clean === "chat" ? "chat" : "convert",
    next: clean === "edit" ? "edit" : clean === "chat" ? "chat" : "trellis",
  };
}

async function nodeEdit(state, onStatus) {
  const { sourceImageB64, lastUserMsg } = state;
  if (!sourceImageB64) {
    return { error: "Please drop a furniture image first.", next: null };
  }
  onStatus("✏️ Editing image with Qwen…");
  const editedImageB64 = await callQwenEdit(sourceImageB64, lastUserMsg);
  return { editedImageB64, next: "trellis" };
}

async function nodeTrellis(state, onStatus) {
  const imageB64 = state.editedImageB64 || state.sourceImageB64;
  if (!imageB64) {
    return { error: "No image to convert. Please drop a photo first.", next: null };
  }
  onStatus("🔄 Converting to 3D with Trellis…");
  const modelUrl = await callTrellis(imageB64);
  return { modelUrl, editedImageB64: null, next: "done" };
}

async function nodeChat(state) {
  const answer = await callOpenAI([
    { role: "system", content: "You are a friendly furniture and interior design assistant for Atelier Oak, a luxury furniture brand. Be concise." },
    ...state.history.slice(-8),
    { role: "user", content: state.lastUserMsg },
  ]);
  return { replyText: answer, next: null };
}

const NODES = { route: nodeRoute, edit: nodeEdit, trellis: nodeTrellis, chat: nodeChat };

async function runGraph(state, onStatus) {
  let s = { ...state, next: "route" };
  let hops = 0;
  while (s.next && hops++ < 8) {
    const fn = NODES[s.next];
    if (!fn) break;
    const update = await fn(s, onStatus);
    s = { ...s, ...update };
    if (s.error) break;
  }
  return s;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = `
  .aoc-fab{position:fixed;bottom:24px;right:24px;width:52px;height:52px;border-radius:50%;background:#3C2A1E;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(60,42,30,0.38);z-index:9000;transition:transform .15s;}
  .aoc-fab:hover{transform:scale(1.08);}
  .aoc-drawer{position:fixed;bottom:88px;right:24px;width:370px;max-height:620px;display:flex;flex-direction:column;background:#fff;border:1.5px solid #E4DBC9;border-radius:16px;box-shadow:0 8px 40px rgba(60,42,30,0.18);z-index:9001;overflow:hidden;}
  @media(max-width:430px){.aoc-drawer{right:0;bottom:0;width:100vw;max-height:88vh;border-radius:16px 16px 0 0;}}
  .aoc-header{padding:13px 16px;background:#3C2A1E;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .aoc-htext{font-family:'Fraunces','Georgia',serif;font-size:15px;font-weight:500;}
  .aoc-hclose{background:none;border:none;cursor:pointer;color:#fff;display:flex;padding:2px;}
  .aoc-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;}
  .aoc-bubble{max-width:88%;padding:10px 13px;border-radius:12px;font-size:13px;line-height:1.55;font-family:'Inter',sans-serif;}
  .aoc-bubble.user{align-self:flex-end;background:#3C2A1E;color:#fff;border-bottom-right-radius:3px;}
  .aoc-bubble.bot{align-self:flex-start;background:#F3EDE1;color:#2B241D;border-bottom-left-radius:3px;}
  .aoc-bubble.sys{align-self:center;background:transparent;color:#8A5A34;font-size:12px;font-style:italic;}
  .aoc-typing{display:flex;gap:5px;padding:10px 14px;background:#F3EDE1;border-radius:12px;border-bottom-left-radius:3px;width:fit-content;}
  .aoc-dot{width:7px;height:7px;border-radius:50%;background:#CFAE89;animation:aoc-b 1.2s ease-in-out infinite;}
  .aoc-dot:nth-child(2){animation-delay:.2s;}
  .aoc-dot:nth-child(3){animation-delay:.4s;}
  @keyframes aoc-b{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}
  .aoc-drop{margin:0 14px 10px;border:1.5px dashed #CFAE89;border-radius:10px;padding:12px;text-align:center;font-size:12px;color:#8A5A34;cursor:pointer;background:rgba(207,174,137,0.07);font-family:'Inter',sans-serif;transition:background .15s;}
  .aoc-drop.over{background:rgba(207,174,137,0.22);}
  .aoc-img-preview{width:100%;max-height:110px;object-fit:cover;border-radius:6px;margin-top:8px;}
  .aoc-model-wrap{margin:0 14px 10px;background:#F3EDE1;border-radius:10px;border:1px solid #E4DBC9;}
  /* While an AR session is live, model-viewer reflects the ar-status
     attribute onto itself. Left at its normal on-page size (200px tall)
     the overlay panel below would be squeezed into that small box
     instead of appearing over the full-screen camera feed, so expand
     the element to fill the viewport for the duration of the session. */
  model-viewer[ar-status="session-started"],
  model-viewer[ar-status="object-placed"]{
    position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;
    width:100vw!important;height:100vh!important;z-index:9999!important;border-radius:0!important;
  }
  .aoc-model-label{padding:8px 12px;font-size:12px;color:#6E6355;font-family:'Inter',sans-serif;}
  .aoc-ar-btn-small{width:100%;padding:9px;background:#3C2A1E;color:#fff;border:none;cursor:pointer;font-size:13px;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;gap:6px;}
  .aoc-footer{padding:10px 12px;border-top:1px solid #E4DBC9;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;}
  .aoc-input{flex:1;padding:9px 12px;font-size:13px;font-family:'Inter',sans-serif;border:1.5px solid #E4DBC9;border-radius:8px;outline:none;resize:none;line-height:1.45;max-height:90px;color:#2B241D;background:#fff;}
  .aoc-input:focus{border-color:#CFAE89;}
  .aoc-send{padding:9px 13px;background:#3C2A1E;color:#fff;border:none;cursor:pointer;border-radius:8px;display:flex;flex-shrink:0;}
  .aoc-send:disabled{opacity:.4;cursor:not-allowed;}
  .aoc-clip{background:none;border:none;cursor:pointer;color:#8A5A34;display:flex;padding:9px 6px;}
  /* AR overlay variant — injected as child of model-viewer */
  .aoc-ar-overlay{position:absolute;bottom:10px;left:10px;right:10px;max-height:320px;display:flex;flex-direction:column;background:rgba(30,24,18,0.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,0.2);border-radius:14px;overflow:hidden;pointer-events:auto;z-index:100;}
  .aoc-ar-messages{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;}
  .aoc-ar-bubble{max-width:90%;padding:8px 11px;border-radius:10px;font-size:12px;line-height:1.5;font-family:'Inter',sans-serif;}
  .aoc-ar-bubble.user{align-self:flex-end;background:rgba(255,255,255,0.18);color:#fff;border-bottom-right-radius:3px;}
  .aoc-ar-bubble.bot{align-self:flex-start;background:rgba(255,255,255,0.1);color:#F3EDE1;border-bottom-left-radius:3px;}
  .aoc-ar-footer{padding:8px 10px;border-top:1px solid rgba(255,255,255,0.12);display:flex;gap:7px;align-items:center;flex-shrink:0;}
  .aoc-ar-input{flex:1;padding:7px 10px;font-size:12px;font-family:'Inter',sans-serif;border:1px solid rgba(255,255,255,0.2);border-radius:7px;outline:none;background:rgba(255,255,255,0.12);color:#fff;}
  .aoc-ar-input::placeholder{color:rgba(255,255,255,0.45);}
  .aoc-ar-send{padding:7px 11px;background:rgba(255,255,255,0.18);color:#fff;border:1px solid rgba(255,255,255,0.2);cursor:pointer;border-radius:7px;display:flex;font-size:12px;font-family:'Inter',sans-serif;}
  .aoc-ar-send:disabled{opacity:.4;}
  .aoc-ar-status{padding:4px 12px 6px;font-size:11px;color:rgba(255,255,255,0.6);font-family:'Inter',sans-serif;font-style:italic;text-align:center;}
`;

// ─── AR Overlay (nested inside <model-viewer> when AR is active) ──────────────
function AROverlay({ onNewModel }) {
  const [msgs, setMsgs] = useState([{ role:"bot", text:"Describe changes to the model — I'll re-edit and reload it." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [imgB64, setImgB64] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMsgs(m => [...m, { role:"user", text }]);
    setLoading(true);
    try {
      const state = await runGraph(
        { history: msgs.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
          sourceImageB64: imgB64, editedImageB64: null, modelUrl: null,
          lastUserMsg: text, pendingFile: null },
        setStatusMsg
      );
      if (state.error) { setMsgs(m => [...m, { role:"bot", text: state.error }]); }
      else if (state.modelUrl) {
        onNewModel(state.modelUrl);
        setImgB64(state.sourceImageB64 || imgB64);
        setMsgs(m => [...m, { role:"bot", text:"✅ Model updated in AR!" }]);
      } else if (state.replyText) {
        setMsgs(m => [...m, { role:"bot", text: state.replyText }]);
      }
    } catch(e) {
      setMsgs(m => [...m, { role:"bot", text:`Error: ${e.message}` }]);
    } finally { setLoading(false); setStatusMsg(""); }
  };

  return (
    <div className="aoc-ar-overlay">
      <div className="aoc-ar-messages">
        {msgs.map((m, i) => <div key={i} className={`aoc-ar-bubble ${m.role}`}>{m.text}</div>)}
        {loading && <div className="aoc-ar-bubble bot">{statusMsg || "Working…"}</div>}
        <div ref={endRef} />
      </div>
      <div className="aoc-ar-footer">
        <input
          className="aoc-ar-input"
          placeholder="Describe changes…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==="Enter") send(); }}
        />
        <button className="aoc-ar-send" disabled={loading || !input.trim()} onClick={send}>
          <PaperAirplaneIcon style={{ width:14, height:14 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Main chatbot drawer ──────────────────────────────────────────────────────
export default function ARChatbot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role:"bot", text:"Hi! Drop a furniture photo and I'll convert it to a 3D model you can view in AR. You can also ask me to edit the color, style, or material first." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [modelUrl, setModelUrl] = useState(null);
  const [arActive, setArActive] = useState(false);
  const [graphState, setGraphState] = useState({
    history: [], sourceImageB64: null, editedImageB64: null, modelUrl: null,
  });
  const [dragOver, setDragOver] = useState(false);

  const fileRef = useRef(null);
  const viewerRef = useRef(null);
  const endRef = useRef(null);
  const onIOS = isIOS();

  // Scroll to bottom on new messages
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  // Listen for AR session start/end
  useEffect(() => {
    const node = viewerRef.current;
    if (!node || !modelUrl) return;
    const h = e => {
      const s = e.detail?.status;
      setArActive(s === "session-started" || s === "object-placed");
    };
    node.addEventListener("ar-status", h);
    return () => node.removeEventListener("ar-status", h);
  }, [modelUrl]);

  const addMsg = (role, text) => setMsgs(m => [...m, { role, text }]);

  const handleFile = useCallback((file) => {
    if (!file?.type.startsWith("image/") && file?.type !== "application/pdf") {
      addMsg("sys", "Only images and PDFs are supported.");
      return;
    }
    setPendingFile(file);
    if (file.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(file));
    }
    addMsg("sys", `📎 ${file.name} attached — send a message or press Send to convert directly.`);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const send = async () => {
    const text = input.trim();
    if (!text && !pendingFile) return;
    if (loading) return;

    const displayMsg = text || `Convert: ${pendingFile?.name}`;
    addMsg("user", displayMsg);
    setInput("");
    setLoading(true);

    try {
      // Convert file → base64 if there's a new file
      let sourceB64 = graphState.sourceImageB64;
      if (pendingFile) {
        sourceB64 = await fileToBase64(pendingFile);
        setPendingFile(null); setFilePreview(null);
      }

      const prevHistory = msgs
        .filter(m => m.role === "user" || m.role === "bot")
        .slice(-10)
        .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

      const newState = await runGraph(
        {
          ...graphState,
          sourceImageB64: sourceB64,
          lastUserMsg: text || "Convert this image to a 3D model.",
          pendingFile: null,
          history: prevHistory,
        },
        (s) => setStatusMsg(s)
      );

      if (newState.error) {
        addMsg("bot", newState.error);
      } else if (newState.modelUrl) {
        setModelUrl(newState.modelUrl);
        addMsg("bot", "Here's your 3D model! Tap \"View in your space\" to place it in your room. You can keep describing changes - I'll re-edit the image and regenerate the model.");
      } else if (newState.replyText) {
        addMsg("bot", newState.replyText);
      }

      setGraphState(prev => ({
        ...prev,
        sourceImageB64: sourceB64 || prev.sourceImageB64,
        modelUrl: newState.modelUrl || prev.modelUrl,
        history: [
          ...prevHistory,
          { role:"user", content: displayMsg },
          { role:"assistant", content: newState.replyText || (newState.modelUrl ? "Model ready." : "") },
        ],
      }));
    } catch(e) {
      console.error(e);
      addMsg("bot", `Something went wrong: ${e.message}`);
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  };

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }};

  // Called by AROverlay when Trellis gives back a new model mid-session
  const handleNewModelFromAR = (url) => {
    setModelUrl(url);
    setGraphState(s => ({ ...s, modelUrl: url }));
    if (viewerRef.current) viewerRef.current.src = url;
  };

  return (
    <>
      <style>{S}</style>

      {/* Floating button */}
      <button className="aoc-fab" onClick={() => setOpen(o => !o)} aria-label="AR Design Chatbot">
        {open
          ? <XMarkIcon style={{ width:22, height:22 }} />
          : <ChatBubbleLeftRightIcon style={{ width:22, height:22 }} />}
      </button>

      {open && (
        <div className="aoc-drawer">
          {/* Header */}
          <div className="aoc-header">
            <span className="aoc-htext">AR Design Assistant</span>
            <button className="aoc-hclose" onClick={() => setOpen(false)}>
              <XMarkIcon style={{ width:18, height:18 }} />
            </button>
          </div>

          {/* Messages */}
          <div className="aoc-messages">
            {msgs.map((m, i) => (
              <div key={i} className={`aoc-bubble ${m.role}`}>{m.text}</div>
            ))}
            {loading && (
              <div className="aoc-bubble bot" style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {statusMsg && <span style={{ fontSize:12, color:"#8A5A34" }}>{statusMsg}</span>}
                <div className="aoc-typing">
                  <div className="aoc-dot" /><div className="aoc-dot" /><div className="aoc-dot" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Drop zone */}
          <div
            className={`aoc-drop ${dragOver?"over":""}`}
            onDragOver={e=>{e.preventDefault();setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={handleDrop}
            onClick={()=>fileRef.current?.click()}
          >
            {filePreview
              ? <img src={filePreview} alt="preview" className="aoc-img-preview" />
              : pendingFile
              ? <span>📄 {pendingFile.name} attached</span>
              : <span>Drop a furniture photo here, or click to browse</span>}
            <input
              ref={fileRef} type="file" accept="image/*,application/pdf"
              style={{display:"none"}}
              onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);}}
            />
          </div>

          {/* 3D viewer — appears after Trellis returns a model */}
          {modelUrl && (
            <div className="aoc-model-wrap">
              <div className="aoc-model-label">3D model ready</div>
              <model-viewer
                ref={viewerRef}
                src={modelUrl}
                alt="Generated furniture 3D model"
                ar
                ar-modes="webxr scene-viewer quick-look"
                ar-scale="auto"
                camera-controls
                auto-rotate
                shadow-intensity="1"
                style={{ width:"100%", height:200, display:"block", backgroundColor:"#F3EDE1", borderRadius:10, position:"relative" }}
              >
                {/* AR button */}
                <button slot="ar-button" className="aoc-ar-btn-small">
                  <CubeTransparentIcon style={{ width:15, height:15 }} />
                  View in your space
                </button>

                {/* AR overlay — only rendered when in-browser WebXR is active.
                    Must be a child of <model-viewer> to be included in the DOM
                    overlay. iOS Quick Look cannot host any web HTML in AR, so
                    we skip this there — users describe changes in the regular
                    chat below and the model updates on return. */}
                {!onIOS && arActive && (
                  <AROverlay onNewModel={handleNewModelFromAR} />
                )}
              </model-viewer>

              {onIOS && (
                <p style={{ padding:"6px 12px 10px", fontSize:11, color:"#6E6355", fontFamily:fontSans }}>
                  On iPhone, describe changes in the chat below — the model will update when you return from AR.
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="aoc-footer">
            <button className="aoc-clip" onClick={()=>fileRef.current?.click()} aria-label="Attach file">
              <PaperClipIcon style={{ width:20, height:20 }} />
            </button>
            <textarea
              className="aoc-input"
              rows={1}
              placeholder={pendingFile
                ? "Describe edits, or press Send to convert directly…"
                : modelUrl
                ? "Describe changes — I'll re-edit and regenerate…"
                : "Drop an image, or ask a design question…"}
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={onKey}
            />
            <button
              className="aoc-send"
              onClick={send}
              disabled={loading || (!input.trim() && !pendingFile)}
              aria-label="Send"
            >
              <PaperAirplaneIcon style={{ width:17, height:17 }} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
