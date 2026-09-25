/**
 * ARChatbot.jsx
 *
 * Flow:
 *  1. User drops an image (or ProductPage.jsx's "Generate" button passes a
 *     product photo + chosen color)
 *  2. Your LLM classifies intent / writes the edit instruction
 *      "convert"   → Trellis immediately
 *      "edit"      → Qwen image-edit → Trellis
 *  3. Trellis returns a .glb URL
 *  4. model-viewer renders it with AR button
 *  5. In-AR (Android WebXR): chatbot panel is rendered as a DOM overlay
 *     child of <model-viewer> so it floats over the camera feed.
 *
 * The exported functions below (buildEditPrompt, editImageWithQwen,
 * imageToGlb, runRecolorChain, routeIntent, callOpenAI) are the ONE
 * implementation of this chain. ProductPage.jsx's Color tab "Generate"
 * button imports runRecolorChain from here — same code path as the
 * chatbot, so behavior is identical everywhere.
 *
 * ENV vars (add to .env at project root — no backend needed):
 *   VITE_OPENAI_API_KEY   — your LLM (routing, chat, and turning a
 *                           color into a precise Qwen edit instruction)
 *   VITE_HF_API_TOKEN     — Hugging Face token (huggingface.co/settings/tokens)
 *                           used for Qwen Image Edit via Inference Providers
 *   VITE_QWEN_MODEL_ID    — defaults to Qwen/Qwen-Image-Edit-2511
 *   VITE_TRELLIS_HF_SPACE — the Gradio Space serving TRELLIS, e.g.
 *                           "microsoft/TRELLIS.2" (default target for this
 *                           build — see imageToGlb() for the confirmed
 *                           start_session → image_to_3d → extract_glb chain)
 *
 * NOTE: these keys ship inside the browser bundle since there's no backend
 * — fine for an internal/low-traffic build, but anyone can read them via
 * devtools. If that ever becomes a problem, move just the three fetch/
 * client calls below behind a small server route; nothing else in this
 * file or in ProductPage.jsx needs to change.
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
import { InferenceClient } from "@huggingface/inference";
import { Client as GradioClient } from "@gradio/client";

// ─── Env ──────────────────────────────────────────────────────────────────────
const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
const HF_TOKEN = import.meta.env.VITE_HF_API_TOKEN || "";
const QWEN_MODEL_ID = import.meta.env.VITE_QWEN_MODEL_ID || "Qwen/Qwen-Image-Edit-2511";
const TRELLIS_SPACE = import.meta.env.VITE_TRELLIS_HF_SPACE || "";

const hf = HF_TOKEN ? new InferenceClient(HF_TOKEN) : null;

// ─── Utilities ────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// ─── Step 1: your LLM — routing + turning a color/instruction into a
//     precise Qwen edit prompt ─────────────────────────────────────────────
export async function callOpenAI(messages) {
  if (!OPENAI_KEY) {
    throw new Error("VITE_OPENAI_API_KEY is not set.");
  }
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: "gpt-4o", max_tokens: 600, messages }),
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

export async function routeIntent({ history, lastUserMsg, hasImage }) {
  const systemPrompt = `You are a routing agent for a furniture AR app.
Given the conversation, reply with EXACTLY one word:
- "convert"  → user wants a 3D model from the current image without edits
- "edit"     → user wants to change color, material, texture, or style first
- "chat"     → general question, no image action needed`;
  const raw = await callOpenAI([
    { role: "system", content: systemPrompt },
    ...history.slice(-6),
    { role: "user", content: lastUserMsg || (hasImage ? "Convert this to a 3D model." : "") },
  ]);
  const clean = raw.toLowerCase().replace(/[^a-z]/g, "");
  return { intent: clean === "edit" ? "edit" : clean === "chat" ? "chat" : "convert" };
}

/** Turns a hex color or free-text instruction into one precise edit sentence. */
export async function buildEditPrompt({ productName, colorHex, instruction }) {
  const task = instruction
    ? instruction
    : `Recolor the upholstery/finish to the hex color ${colorHex}, keeping the shape, proportions, materials texture, lighting and background completely unchanged.`;
  if (!OPENAI_KEY) {
    // Fallback so the chain still runs without an LLM key configured.
    return `Photorealistic product photo of a ${productName || "piece of furniture"}. ${task} Do not alter the pose, camera angle, or background.`;
  }
  return callOpenAI([
    {
      role: "system",
      content:
        "You write short, precise image-editing instructions for an AI photo editor. " +
        "Given a product name and a requested change, output ONE sentence describing " +
        "exactly what to change and explicitly stating everything else (shape, materials, " +
        "camera angle, lighting, background) must stay identical. Output only the sentence.",
    },
    { role: "user", content: `Product: ${productName || "furniture piece"}. Requested change: ${task}` },
  ]);
}

// ─── Step 2: Qwen Image Edit (Hugging Face) ────────────────────────────────
export async function editImageWithQwen({ imageUrl, imageBase64, prompt }) {
  if (!hf) throw new Error("VITE_HF_API_TOKEN is not set.");

  let inputBlob;
  if (imageBase64) {
    const bin = atob(imageBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    inputBlob = new Blob([bytes], { type: "image/png" });
  } else if (imageUrl) {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`Could not fetch source image (${r.status})`);
    inputBlob = await r.blob();
  } else {
    throw new Error("editImageWithQwen needs imageUrl or imageBase64");
  }

  // Routed to whichever Inference Provider serves the model (fal /
  // WaveSpeed, per the model card) — same token, no provider-specific code.
  return hf.imageToImage({
    model: QWEN_MODEL_ID,
    inputs: inputBlob,
    parameters: { prompt },
  }); // → Blob
}

// ─── Step 3: Trellis.2 (image → .glb), via its Hugging Face Space ─────────
// Confirmed against microsoft/TRELLIS.2's own "Use via API" (JS) docs.
// This Space is session-based: start_session must be called first, then
// image_to_3d runs the generation and stores the result server-side against
// that session, then extract_glb exports it as an actual downloadable .glb.
// All three calls MUST go through the same `client` instance so the Space
// ties them to the same session_hash.
export async function imageToGlb(imageBlob, onStatus = () => {}) {
  if (!TRELLIS_SPACE) throw new Error("VITE_TRELLIS_HF_SPACE is not set.");

  const client = await GradioClient.connect(TRELLIS_SPACE, { hf_token: HF_TOKEN || undefined });

  onStatus("Starting Trellis session…");
  await client.predict("/start_session", {});

  onStatus("Generating the 3D asset (this can take a minute)…");
  await client.predict("/image_to_3d", {
    image: imageBlob,
    seed: 0,
    resolution: "1024",
    ss_guidance_strength: 7.5,
    ss_guidance_rescale: 0.7,
    ss_sampling_steps: 12,
    ss_rescale_t: 5,
    shape_slat_guidance_strength: 7.5,
    shape_slat_guidance_rescale: 0.5,
    shape_slat_sampling_steps: 12,
    shape_slat_rescale_t: 3,
    tex_slat_guidance_strength: 1,
    tex_slat_guidance_rescale: 0,
    tex_slat_sampling_steps: 12,
    tex_slat_rescale_t: 3,
  });

  onStatus("Exporting the GLB file…");
  const result = await client.predict("/extract_glb", {
    decimation_target: 300000,
    texture_size: 2048,
  });

  // extract_glb returns [Model3d file, DownloadButton file] — try the
  // download button entry first, fall back to the Model3d entry.
  const [model3d, downloadBtn] = Array.isArray(result.data) ? result.data : [result.data];
  const glbFile = downloadBtn || model3d;
  let glbUrl = glbFile?.url || glbFile?.path;

  if (glbUrl && !/^https?:\/\//i.test(glbUrl)) {
    // Gradio sometimes hands back a server-local filesystem path instead
    // of a full URL — resolve it against the Space's own origin so the
    // browser can actually fetch it, instead of silently failing to load
    // (which makes model-viewer just keep showing whatever was already
    // rendered, looking exactly like nothing happened).
    const root = client.config?.root || `https://${TRELLIS_SPACE.replace("/", "-")}.hf.space`;
    glbUrl = `${root.replace(/\/$/, "")}/file=${glbUrl}`;
  }

  console.log("[Trellis] resolved .glb URL:", glbUrl, "| raw response:", glbFile);
  if (!glbUrl) throw new Error("Trellis Space returned no .glb file");
  return glbUrl;
}

/**
 * Combined chain: color OR free-text instruction → prompt → Qwen → Trellis
 * → glb URL. This is what both the chatbot and ProductPage.jsx's Generate
 * button call — the one place this pipeline is implemented.
 */
export async function runRecolorChain({ productName, imageUrl, imageBase64, colorHex, instruction }, onStatus = () => {}) {
  onStatus("Writing the edit instruction…");
  const prompt = await buildEditPrompt({ productName, colorHex, instruction });

  onStatus("Editing the photo with Qwen…");
  const editedBlob = await editImageWithQwen({ imageUrl, imageBase64, prompt });

  const modelUrl = await imageToGlb(editedBlob, onStatus);

  return { modelUrl, prompt };
}

// ─── LangGraph-style state machine (chat flow only) ──────────────────────
/**
 * Graph state shape:
 * {
 *   history:        [{role, content}],
 *   sourceImageB64: string|null,
 *   modelUrl:       string|null,
 *   lastUserMsg:    string,
 *   pendingFile:    File|null,
 *   statusMsg:      string,
 *   error:          string|null,
 * }
 */

async function nodeRoute(state) {
  const { intent } = await routeIntent({
    history: state.history.slice(-6),
    lastUserMsg: state.lastUserMsg,
    hasImage: !!state.sourceImageB64,
  });
  return { intent, next: intent === "edit" ? "edit" : intent === "chat" ? "chat" : "convertAndEdit" };
}

// "convert" and "edit" both end up in the same chain — the only difference
// is whether the user typed an instruction to apply first.
async function nodeConvertAndEdit(state, onStatus) {
  const { sourceImageB64, lastUserMsg, intent } = state;
  if (!sourceImageB64) {
    return { error: "Please drop a furniture image first.", next: null };
  }
  const { modelUrl } = await runRecolorChain(
    { imageBase64: sourceImageB64, instruction: intent === "edit" ? lastUserMsg : null },
    onStatus
  );
  return { modelUrl, next: "done" };
}

async function nodeChat(state) {
  const reply = await callOpenAI([
    { role: "system", content: "You are a friendly furniture and interior design assistant for Assian Furniture. Be concise." },
    ...state.history.slice(-8),
    { role: "user", content: state.lastUserMsg },
  ]);
  return { replyText: reply, next: null };
}

const NODES = { route: nodeRoute, edit: nodeConvertAndEdit, convertAndEdit: nodeConvertAndEdit, chat: nodeChat };

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
          sourceImageB64: imgB64, modelUrl: null,
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
    history: [], sourceImageB64: null, modelUrl: null,
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
