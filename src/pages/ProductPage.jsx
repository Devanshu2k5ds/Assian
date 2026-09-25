/**
 * ProductPage.jsx — fixes in this version:
 *
 * 1. AR chatbot overlay — ARChatbot renders as child of <model-viewer> on
 *    Android WebXR so it floats over the camera feed.
 * 2. Pre-AR edit panel — always visible before "View in your space" is tapped,
 *    so users can adjust size/color before entering AR.
 * 3. UI bugs fixed — all text now on one line, values never clipped.
 * 4. Hide/show toggle for the overlay panel (chevron button).
 * 5. Pinch-sync — model-viewer's `camera-change` + scale polling keeps the
 *    displayed size values in sync when the user pinch-resizes in AR.
 *    Manual text inputs added for both cm/ft and RGB hex.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import {
  ArrowLeftIcon, CubeTransparentIcon, ArrowPathIcon,
  ChevronDownIcon, ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { colors, fontSerif, fontSans } from "../lib/theme";
import Eyebrow from "../components/Eyebrow";
import collections from "../data/collections";
import { runRecolorChain } from "../components/ARChatbot";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pctToMul = (p) => (p / 100).toFixed(3);

function cmToFtIn(cm) {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let ins = Math.round(totalIn % 12);
  if (ins === 12) { ft++; ins = 0; }
  return { ft, ins };
}

function ftInToCm(ft, ins) {
  return ((ft * 12 + ins) * 2.54);
}

function formatLength(cm, unit) {
  if (unit === "cm") return `${Math.round(cm)}`;
  const { ft, ins } = cmToFtIn(cm);
  return `${ft}'${ins}"`;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function hexToRgb01(hex) {
  const c = hex.replace("#", "");
  const n = parseInt(c, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

function hexToRgb255(hex) {
  const c = hex.replace("#", "");
  const n = parseInt(c, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgb255ToHex(r, g, b) {
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsl(hex) { 
  let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = ((g-b)/d+(g<b?6:0))/6; break;
      case g: h = ((b-r)/d+2)/6; break;
      default: h = ((r-g)/d+4)/6;
    }
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1-l);
  const f = n => {
    const k = (n+h/30)%12;
    return Math.round(255*(l - a*Math.max(Math.min(k-3,9-k,1),-1))).toString(16).padStart(2,"0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const PRESETS = [
  {name:"Oak",hex:"#b58a5a"},{name:"Walnut",hex:"#5c3a21"},
  {name:"Charcoal",hex:"#3a3a3a"},{name:"Cream",hex:"#f0e6d2"},
  {name:"Sage",hex:"#8a9a7b"},{name:"Rust",hex:"#a85434"},
];

// ─── Global styles ─────────────────────────────────────────────────────────────
const STYLES = `
  *{box-sizing:border-box;}
  .ao-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;background:rgba(60,42,30,0.2);border-radius:999px;outline:none;display:block;}
  .ao-range::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#3C2A1E;border:3px solid #fff;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,0.3);margin-top:-9px;}
  .ao-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:rgba(60,42,30,0.2);}
  .ao-range::-moz-range-track{height:4px;border-radius:999px;background:rgba(60,42,30,0.2);}
  .ao-range::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#3C2A1E;border:3px solid #fff;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,0.3);}
  .ao-light-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:999px;outline:none;display:block;cursor:pointer;}
  .ao-light-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid #bbb;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.25);margin-top:-7px;}
  .ao-light-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;}
  .ao-light-range::-moz-range-track{height:4px;border-radius:999px;}
  .ao-light-range::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:#fff;border:2px solid #bbb;cursor:pointer;}
  .ao-seg{display:inline-flex;border-radius:6px;overflow:hidden;border:1.5px solid #E4DBC9;flex-shrink:0;}
  .ao-seg-btn{padding:6px 16px;font-size:12px;font-family:'Inter',sans-serif;cursor:pointer;border:none;white-space:nowrap;}
  .ao-seg-btn.on{background:#3C2A1E;color:#fff;}
  .ao-seg-btn:not(.on){background:transparent;color:#6E6355;}
  .ao-text-input{padding:7px 10px;font-size:13px;font-family:'Inter',sans-serif;border:1.5px solid #E4DBC9;border-radius:6px;outline:none;color:#2B241D;background:#fff;min-width:0;}
  .ao-text-input:focus{border-color:#CFAE89;}
  .ao-swatch{width:26px;height:26px;border-radius:50%;cursor:pointer;border:2.5px solid transparent;box-shadow:0 1px 3px rgba(0,0,0,0.18);flex-shrink:0;}
  .ao-swatch.sel,.ao-swatch:hover{border-color:#3C2A1E;}
  .ao-wheel-canvas{border-radius:50%;cursor:crosshair;touch-action:none;display:block;}
  /* While an AR session is live, model-viewer reflects the ar-status
     attribute onto itself. The element normally stays sized to its
     on-page box (420px tall) even during the AR camera session, so any
     absolutely-positioned overlay child gets confined to that small box
     instead of the full screen. Expanding it to fill the viewport while
     "session-started"/"object-placed" is what makes the overlay panel
     actually appear over the camera feed. */
  model-viewer[ar-status="session-started"],
  model-viewer[ar-status="object-placed"]{
    position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;
    width:100vw!important;height:100vh!important;z-index:9999!important;border-radius:0!important;
  }
  /* AR overlay panel */
  .ar-overlay{position:absolute;left:8px;right:8px;bottom:8px;background:rgba(20,15,10,0.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.18);border-radius:14px;pointer-events:auto;overflow:hidden;}
  .ar-overlay-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 0;}
  /* Fixed height (with internal scroll) so the box stays the same size
     whether the Size tab (sliders) or the Color tab (wheel + swatches)
     is active — otherwise the panel visibly grows/shrinks and jumps
     around the screen when switching tabs. */
  .ar-overlay-body{padding:12px 14px 14px;height:250px;overflow-y:auto;-webkit-overflow-scrolling:touch;}
  /* page panel */
  .page-panel{margin-top:18px;background:#fff;border:1.5px solid #E4DBC9;border-radius:10px;overflow:hidden;}
  .page-panel-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #E4DBC9;cursor:pointer;user-select:none;}
  .page-panel-body{padding:16px;}
  /* dim row */
  .dim-row{display:grid;grid-template-columns:56px 1fr 80px;gap:8px;align-items:center;margin-bottom:4px;}
  .dim-label{font-family:'Inter',sans-serif;font-size:13px;font-weight:600;color:#2B241D;white-space:nowrap;}
  .dim-val{font-family:'Inter',sans-serif;font-size:13px;color:#6E6355;text-align:right;}
  /* AR dim row (compact, light text) */
  .ar-dim-row{display:grid;grid-template-columns:52px 1fr 72px;gap:6px;align-items:center;margin-bottom:4px;}
  .ar-dim-label{font-family:'Inter',sans-serif;font-size:12px;font-weight:600;color:rgba(255,255,255,0.9);}
  .ar-dim-val{font-family:'Inter',sans-serif;font-size:12px;color:rgba(255,255,255,0.6);text-align:right;}
  /* AR range (lighter track) */
  .ar-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;background:rgba(255,255,255,0.25);border-radius:999px;outline:none;display:block;}
  .ar-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:2.5px solid rgba(60,42,30,0.7);cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.35);margin-top:-8px;}
  .ar-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;}
  .ar-range::-moz-range-track{height:4px;border-radius:999px;background:rgba(255,255,255,0.25);}
  .ar-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:2.5px solid rgba(60,42,30,0.7);cursor:pointer;}
  /* mobile single-column */
  @media(max-width:640px){
    .product-grid{grid-template-columns:1fr!important;}
    model-viewer{height:300px!important;}
  }
`;

// ─── RGB Wheel ────────────────────────────────────────────────────────────────
function RGBWheel({ hex, onChange, size: wheelSize = 160 }) {
  const canvasRef = useRef(null);
  const dragging = useRef(false);
  const r = wheelSize / 2 - 2;
  const cx = wheelSize / 2, cy = wheelSize / 2;
  const [hsl, setHsl] = useState(() => hexToHsl(hex || "#b58a5a"));

  useEffect(() => { setHsl(hexToHsl(hex || "#b58a5a")); }, [hex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, wheelSize, wheelSize);
    for (let a = 0; a < 360; a++) {
      const s1 = (a - 1) * Math.PI / 180, s2 = (a + 1) * Math.PI / 180;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `hsl(${a},0%,${hsl[2]}%)`);
      g.addColorStop(1, `hsl(${a},100%,${hsl[2]}%)`);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, s1, s2); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
    }
    // dot
    const da = (hsl[0] * Math.PI) / 180;
    const dr = (hsl[1] / 100) * r;
    const dx = cx + dr * Math.cos(da), dy = cy - dr * Math.sin(da);
    ctx.beginPath(); ctx.arc(dx, dy, 7, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#3C2A1E"; ctx.lineWidth = 2; ctx.stroke();
  }, [hsl, wheelSize]);

  const pick = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = wheelSize / rect.width, scaleY = wheelSize / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * scaleX - cx;
    const y = (clientY - rect.top) * scaleY - cy;
    const angle = Math.round((Math.atan2(-y, x) * 180 / Math.PI + 360) % 360);
    const dist = Math.min(Math.sqrt(x*x + y*y), r);
    const sat = Math.round((dist / r) * 100);
    const newHsl = [angle, sat, hsl[2]];
    setHsl(newHsl);
    onChange(hslToHex(...newHsl));
  }, [hsl, cx, cy, r, wheelSize, onChange]);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
      <canvas
        ref={canvasRef}
        className="ao-wheel-canvas"
        width={wheelSize} height={wheelSize}
        style={{ width:wheelSize, height:wheelSize }}
        onMouseDown={e=>{dragging.current=true; pick(e);}}
        onMouseMove={e=>{if(dragging.current)pick(e);}}
        onMouseUp={()=>{dragging.current=false;}}
        onMouseLeave={()=>{dragging.current=false;}}
        onTouchStart={e=>{e.preventDefault();dragging.current=true;pick(e);}}
        onTouchMove={e=>{e.preventDefault();if(dragging.current)pick(e);}}
        onTouchEnd={()=>{dragging.current=false;}}
      />
      <div style={{width:"100%"}}>
        <div style={{fontSize:11,color:colors.textMuted,fontFamily:fontSans,marginBottom:4}}>Lightness</div>
        <input
          type="range" className="ao-light-range"
          min={5} max={95} value={hsl[2]}
          style={{background:`linear-gradient(to right,hsl(${hsl[0]},${hsl[1]}%,5%),hsl(${hsl[0]},${hsl[1]}%,50%),hsl(${hsl[0]},${hsl[1]}%,95%))`}}
          onChange={e=>{const n=[hsl[0],hsl[1],Number(e.target.value)];setHsl(n);onChange(hslToHex(...n));}}
        />
      </div>
    </div>
  );
}

// ─── Seg control ──────────────────────────────────────────────────────────────
function Seg({ options, value, onChange }) {
  return (
    <div className="ao-seg">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          className={`ao-seg-btn ${value===o.id?"on":""}`}
          onClick={(e) => { e.stopPropagation(); onChange(o.id); }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Size tab (page) ──────────────────────────────────────────────────────────
// Dimension with slider + manual text input
function DimRow({ label, pct, baseCm, unit, onChange }) {
  const currentCm = baseCm * (pct / 100);
  const [inputVal, setInputVal] = useState("");
  const [editing, setEditing] = useState(false);

  // Keep input synced when slider or external change moves it
  useEffect(() => {
    if (!editing) {
      setInputVal(unit === "cm"
        ? String(Math.round(currentCm))
        : (() => { const {ft,ins}=cmToFtIn(currentCm); return `${ft}'${ins}"`; })()
      );
    }
  }, [currentCm, unit, editing]);

  const commitInput = () => {
    setEditing(false);
    const raw = inputVal.trim();
    let cm;
    if (unit === "cm") {
      cm = parseFloat(raw);
    } else {
      // parse  5'8"  or  5 8
      const m = raw.match(/(\d+)[''`]?\s*(\d+)/);
      cm = m ? ftInToCm(parseInt(m[1]), parseInt(m[2])) : parseFloat(raw) * 30.48;
    }
    if (!isNaN(cm) && cm > 0) {
      const newPct = Math.round(Math.max(50, Math.min(150, (cm / baseCm) * 100)));
      onChange(newPct);
    }
  };

  return (
    <div style={{marginBottom:10}}>
      <div className="dim-row">
        <span className="dim-label">{label}</span>
        <input
          type="range" className="ao-range"
          min={50} max={150} step={1} value={pct}
          onChange={e=>onChange(Number(e.target.value))}
        />
        <input
          className="ao-text-input dim-val"
          value={inputVal}
          onFocus={()=>setEditing(true)}
          onChange={e=>setInputVal(e.target.value)}
          onBlur={commitInput}
          onKeyDown={e=>{if(e.key==="Enter")commitInput();}}
          style={{width:72,textAlign:"right"}}
        />
      </div>
    </div>
  );
}

function SizeTab({ size, setSize, unit, setUnit, product }) {
  const isDefault = size.width===100 && size.height===100 && size.depth===100;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <Seg options={[{id:"cm",label:"cm"},{id:"ft",label:"ft/in"}]} value={unit} onChange={setUnit} />
        {!isDefault && (
          <button onClick={()=>setSize({width:100,height:100,depth:100})}
            style={{fontFamily:fontSans,fontSize:12,color:colors.brownDeep,display:"flex",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer"}}>
            <ArrowPathIcon style={{width:13,height:13}}/> Reset
          </button>
        )}
      </div>
      <DimRow label="Width"  pct={size.width}  baseCm={product.dimensions.width}  unit={unit} onChange={w=>setSize(s=>({...s,width:w}))} />
      <DimRow label="Height" pct={size.height} baseCm={product.dimensions.height} unit={unit} onChange={h=>setSize(s=>({...s,height:h}))} />
      <DimRow label="Length" pct={size.depth}  baseCm={product.dimensions.depth}  unit={unit} onChange={d=>setSize(s=>({...s,depth:d}))} />
    </div>
  );
}

// ─── Generate block (shared by ColorTab + ARColorRow) ─────────────────────────
// One implementation so the "Generate" button behaves and reads the same
// whether you're on the page panel or the AR overlay.
function GenerateBlock({ dark, generating, status, error, disabled, onGenerate, hasGenerated, onResetGenerated }) {
  const mutedColor = dark ? "rgba(255,255,255,0.55)" : colors.textMuted;
  const errorColor = dark ? "#ffb4a8" : "#b3261e";
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.15)" : colors.hairline}` }}>
      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled || generating}
        style={{
          width: "100%", padding: "10px 14px", fontSize: 13, fontFamily: fontSans,
          background: colors.espresso, color: "#fff", border: "none", borderRadius: 6,
          cursor: (disabled || generating) ? "not-allowed" : "pointer",
          opacity: (disabled || generating) ? 0.55 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        {generating ? (status || "Generating…") : "Generate"}
      </button>
      {!disabled && !generating && (
        <p style={{ fontFamily: fontSans, fontSize: 11, color: mutedColor, marginTop: 6, marginBottom: 0 }}>
          Sends this color to our AI pipeline to render and re-model the piece — takes a minute or two.
        </p>
      )}
      {disabled && !generating && (
        <p style={{ fontFamily: fontSans, fontSize: 11, color: mutedColor, marginTop: 6, marginBottom: 0 }}>
          Pick a color above first.
        </p>
      )}
      {error && (
        <p style={{ fontFamily: fontSans, fontSize: 11, color: errorColor, marginTop: 6, marginBottom: 0 }}>
          {error}
        </p>
      )}
      {hasGenerated && !generating && (
        <button
          type="button"
          onClick={onResetGenerated}
          style={{ fontFamily: fontSans, fontSize: 11, color: dark ? "rgba(255,255,255,0.8)" : colors.brownDeep, background: "none", border: "none", cursor: "pointer", marginTop: 6, padding: 0, textDecoration: "underline" }}
        >
          Back to original photo model
        </button>
      )}
    </div>
  );
}

// ─── Color tab (page) ─────────────────────────────────────────────────────────
function ColorTab({ color, setColor, generating, generateStatus, generateError, onGenerate, hasGenerated, onResetGenerated }) {
  const defaultHex = "#b58a5a";
  const [hex, setHex] = useState(color || defaultHex);
  const [rgbInput, setRgbInput] = useState({r:"",g:"",b:""});
  const [editingRgb, setEditingRgb] = useState(false);
  const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

  const apply = useCallback((h) => { setHex(h); setColor(h); }, [setColor]);

  useEffect(() => {
    if (!editingRgb) {
      const {r,g,b} = hexToRgb255(hex);
      setRgbInput({r:String(r),g:String(g),b:String(b)});
    }
  }, [hex, editingRgb]);

  const commitRgb = () => {
    setEditingRgb(false);
    const r=parseInt(rgbInput.r), g=parseInt(rgbInput.g), b=parseInt(rgbInput.b);
    if(!isNaN(r)&&!isNaN(g)&&!isNaN(b)) apply(rgb255ToHex(r,g,b));
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontFamily:fontSans,fontSize:12,color:colors.textMuted}}>Choose a finish</span>
        {color && (
          <button onClick={()=>{apply(defaultHex);setColor(null);}}
            style={{fontFamily:fontSans,fontSize:12,color:colors.brownDeep,display:"flex",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer"}}>
            <ArrowPathIcon style={{width:13,height:13}}/> Reset
          </button>
        )}
      </div>

      <RGBWheel hex={hex} onChange={apply} size={160} />

      {/* Hex input */}
      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:12}}>
        <div style={{width:28,height:28,borderRadius:"50%",background:hex,border:"2px solid #E4DBC9",flexShrink:0}}/>
        <input className="ao-text-input" style={{flex:1}} type="text" value={hex} placeholder="#b58a5a" maxLength={7}
          onChange={e=>{
            const v=e.target.value.startsWith("#")?e.target.value:`#${e.target.value}`;
            setHex(e.target.value);
            if(HEX_RE.test(v))apply(v);
          }}
        />
      </div>

      {/* RGB inputs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10}}>
        {["r","g","b"].map(ch=>(
          <div key={ch}>
            <div style={{fontSize:11,fontFamily:fontSans,color:colors.textMuted,marginBottom:3,textAlign:"center"}}>{ch.toUpperCase()}</div>
            <input className="ao-text-input" style={{width:"100%",textAlign:"center"}} type="number" min={0} max={255}
              value={rgbInput[ch]}
              onFocus={()=>setEditingRgb(true)}
              onChange={e=>setRgbInput(v=>({...v,[ch]:e.target.value}))}
              onBlur={commitRgb}
              onKeyDown={e=>{if(e.key==="Enter")commitRgb();}}
            />
          </div>
        ))}
      </div>

      {/* Presets */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
        {PRESETS.map(p=>(
          <button key={p.hex} title={p.name} className={`ao-swatch ${hex===p.hex?"sel":""}`}
            style={{backgroundColor:p.hex}} onClick={()=>apply(p.hex)} aria-label={p.name}/>
        ))}
      </div>

      <GenerateBlock
        generating={generating}
        status={generateStatus}
        error={generateError}
        disabled={!color}
        onGenerate={onGenerate}
        hasGenerated={hasGenerated}
        onResetGenerated={onResetGenerated}
      />
    </div>
  );
}

// ─── AR overlay size tab (compact, white text) ────────────────────────────────
function ARSizeRow({ label, pct, baseCm, unit, onChange }) {
  const currentCm = baseCm * (pct / 100);
  return (
    <div style={{marginBottom:8}}>
      <div className="ar-dim-row">
        <span className="ar-dim-label">{label}</span>
        <input type="range" className="ar-range" min={50} max={150} step={1} value={pct}
          onChange={e=>onChange(Number(e.target.value))}/>
        <span className="ar-dim-val">{formatLength(currentCm, unit)} {unit}</span>
      </div>
    </div>
  );
}

function ARColorRow({ color, setColor, generating, generateStatus, generateError, onGenerate, hasGenerated, onResetGenerated }) {
  const [hex, setHex] = useState(color || "#b58a5a");
  const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
  const apply = (h) => { setHex(h); setColor(h); };
  return (
    <div>
      <RGBWheel hex={hex} onChange={apply} size={130} />
      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
        <div style={{width:22,height:22,borderRadius:"50%",background:hex,border:"1.5px solid rgba(255,255,255,0.4)",flexShrink:0}}/>
        <input
          style={{flex:1,padding:"6px 8px",fontSize:12,fontFamily:fontSans,border:"1px solid rgba(255,255,255,0.25)",borderRadius:6,outline:"none",background:"rgba(255,255,255,0.12)",color:"#fff"}}
          type="text" value={hex} placeholder="#b58a5a" maxLength={7}
          onChange={e=>{
            const v=e.target.value.startsWith("#")?e.target.value:`#${e.target.value}`;
            setHex(e.target.value);
            if(HEX_RE.test(v))apply(v);
          }}
        />
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
        {PRESETS.map(p=>(
          <button key={p.hex} title={p.name} className={`ao-swatch ${hex===p.hex?"sel":""}`}
            style={{backgroundColor:p.hex,width:22,height:22}} onClick={()=>apply(p.hex)}/>
        ))}
      </div>

      <GenerateBlock
        dark
        generating={generating}
        status={generateStatus}
        error={generateError}
        disabled={!color}
        onGenerate={onGenerate}
        hasGenerated={hasGenerated}
        onResetGenerated={onResetGenerated}
      />
    </div>
  );
}

// Full AR overlay panel (inside model-viewer DOM overlay)
function ARPanel({ size, setSize, unit, setUnit, color, setColor, product, generating, generateStatus, generateError, onGenerate, hasGenerated, onResetGenerated }) {
  const [activeTab, setActiveTab] = useState("size");
  const [visible, setVisible] = useState(true);
  return (
    <div className="ar-overlay">
      <div className="ar-overlay-header">
        <Seg
          options={[{id:"size",label:"Size"},{id:"color",label:"Color"}]}
          value={activeTab} onChange={setActiveTab}
        />
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Seg options={[{id:"cm",label:"cm"},{id:"ft",label:"ft/in"}]} value={unit} onChange={setUnit} />
          <button
            onClick={()=>setVisible(v=>!v)}
            style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.7)",display:"flex",padding:4}}
            aria-label={visible?"Hide panel":"Show panel"}
          >
            {visible
              ? <ChevronDownIcon style={{width:18,height:18}}/>
              : <ChevronUpIcon style={{width:18,height:18}}/>}
          </button>
        </div>
      </div>
      {visible && (
        <div className="ar-overlay-body">
          {activeTab === "size" ? (
            <>
              <ARSizeRow label="Width"  pct={size.width}  baseCm={product.dimensions.width}  unit={unit} onChange={w=>setSize(s=>({...s,width:w}))}/>
              <ARSizeRow label="Height" pct={size.height} baseCm={product.dimensions.height} unit={unit} onChange={h=>setSize(s=>({...s,height:h}))}/>
              <ARSizeRow label="Length" pct={size.depth}  baseCm={product.dimensions.depth}  unit={unit} onChange={d=>setSize(s=>({...s,depth:d}))}/>
            </>
          ) : (
            <ARColorRow
              color={color} setColor={setColor}
              generating={generating} generateStatus={generateStatus} generateError={generateError}
              onGenerate={onGenerate} hasGenerated={hasGenerated} onResetGenerated={onResetGenerated}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page panel (always-visible before AR) ───────────────────────────────────
function PagePanel({ size, setSize, unit, setUnit, color, setColor, product, generating, generateStatus, generateError, onGenerate, hasGenerated, onResetGenerated }) {
  const [activeTab, setActiveTab] = useState("size");
  const [open, setOpen] = useState(true);
  return (
    <div className="page-panel">
      <div className="page-panel-header" style={{cursor:"default"}}>
        {/* Tab switcher — stop propagation so it never accidentally
            triggers the collapse button's area */}
        <div style={{display:"flex",gap:10,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
          <Seg
            options={[{id:"size",label:"Size"},{id:"color",label:"Color"}]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>
        {/* Collapse toggle is its own button, separate from the tab row */}
        <button
          type="button"
          onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}
          style={{background:"none",border:"none",cursor:"pointer",color:colors.textMuted,display:"flex",padding:4}}
          aria-label={open?"Collapse":"Expand"}
        >
          {open ? <ChevronUpIcon style={{width:18,height:18}}/> : <ChevronDownIcon style={{width:18,height:18}}/>}
        </button>
      </div>
      {open && (
        <div className="page-panel-body">
          {activeTab==="size"
            ? <SizeTab size={size} setSize={setSize} unit={unit} setUnit={setUnit} product={product}/>
            : <ColorTab
                color={color} setColor={setColor}
                generating={generating} generateStatus={generateStatus} generateError={generateError}
                onGenerate={onGenerate} hasGenerated={hasGenerated} onResetGenerated={onResetGenerated}
              />}
        </div>
      )}
    </div>
  );
}

// ─── ProductPage ──────────────────────────────────────────────────────────────
export default function ProductPage() {
  const { slug, productSlug } = useParams();
  const collection = collections[slug];
  const product = collection?.products.find(p => p.slug === productSlug);

  const viewerRef = useRef(null);
  const origFactors = useRef([]);
  const origSheenFactors = useRef([]);

  const [size, setSize] = useState({ width:100, height:100, depth:100 });
  const [unit, setUnit] = useState("cm");
  const [color, setColor] = useState(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [arActive, setArActive] = useState(false);
  const [generatedModelUrl, setGeneratedModelUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState("");
  const [generateError, setGenerateError] = useState("");
  const onIOS = isIOS();

  // Reset load state whenever the product changes (e.g. navigating between
  // product pages) so the color effect re-fires for the new model's materials.
  useEffect(() => {
    setModelLoaded(false);
    origFactors.current = [];
    origSheenFactors.current = [];
    setGeneratedModelUrl(null);
    setGenerateError("");
  }, [product?.slug]);

  // Listen for AR status + model load
  useEffect(() => {
    const node = viewerRef.current;
    if (!node) return;
    const onAr = e => {
      const s = e.detail?.status;
      setArActive(s === "session-started" || s === "object-placed");
    };
    const captureFactors = async () => {
      const mats = node.model?.materials || [];
      if (mats.length > 0) {
        // GlamVelvetSofa ships multiple built-in fabric-color variants
        // (KHR_materials_variants). model-viewer only loads whichever one
        // is currently active — reading pbrMetallicRoughness/sheen off an
        // unloaded variant material throws synchronously, so make sure
        // each material is loaded first.
        await Promise.all(mats.map(m => m.ensureLoaded?.().catch(() => {})));
        origFactors.current = mats.map(m => [...m.pbrMetallicRoughness.baseColorFactor]);
        origSheenFactors.current = mats.map(m => m.sheen ? [...m.sheen.sheenColorFactor] : null);
        setModelLoaded(true);
      }
    };
    const onLoad = () => captureFactors();
    const onError = (e) => {
      console.error("[model-viewer] failed to load src:", node.getAttribute("src"), e);
      if (generatedModelUrl) {
        setGenerateError(
          "The generated model failed to load in the viewer (bad or unreachable URL) — showing the original model instead. Check the console for the exact URL that failed."
        );
      }
    };
    node.addEventListener("ar-status", onAr);
    node.addEventListener("load", onLoad);
    node.addEventListener("error", onError);
    // If model-viewer already loaded (cached / fast connection) fire immediately
    if (node.loaded) captureFactors();
    return () => {
      node.removeEventListener("ar-status", onAr);
      node.removeEventListener("load", onLoad);
      node.removeEventListener("error", onError);
    };
  }, [product, generatedModelUrl]);

  // Sync color onto model whenever color changes OR whenever the model
  // finishes loading (covers the case where the user picks a color before
  // the .glb has fully loaded).
  useEffect(() => {
    const node = viewerRef.current;
    if (!node || !modelLoaded) return;
    const mats = node.model?.materials;
    if (!mats || mats.length === 0) return;
    let cancelled = false;
    (async () => {
      await Promise.all(mats.map(m => m.ensureLoaded?.().catch(() => {})));
      if (cancelled) return;
      if (color) {
        const rgba = hexToRgb01(color);
        const rgb = [rgba[0], rgba[1], rgba[2]];
        mats.forEach(m => {
          try { m.pbrMetallicRoughness.setBaseColorFactor(rgba); } catch(_) {}
          // Fabrics like GlamVelvetSofa use KHR_materials_sheen — that layer
          // visually dominates velvet-like surfaces, so baseColorFactor alone
          // barely shows. Tint it too when the material has one.
          try { m.sheen?.setSheenColorFactor(rgb); } catch(_) {}
        });
      } else {
        // Revert to per-material original
        mats.forEach((m, i) => {
          const orig = origFactors.current[i];
          if (orig) {
            try { m.pbrMetallicRoughness.setBaseColorFactor(orig); } catch(_) {}
          }
          const origSheen = origSheenFactors.current[i];
          if (origSheen) {
            try { m.sheen?.setSheenColorFactor(origSheen); } catch(_) {}
          }
        });
      }
    })();
    return () => { cancelled = true; };
  }, [color, modelLoaded]);

  // Pinch-sync: poll model-viewer's live scale when in AR so the size
  // sliders stay in sync when the user pinch-resizes the placed model.
  //
  // NOTE: `node.getAttribute("scale")` only ever returns whatever value
  // React last wrote to that attribute — model-viewer's AR pinch gesture
  // does not write back to the DOM attribute, so polling the attribute
  // alone can never see a pinch change. The live `scale` object on the
  // element instance (kept in sync internally as the user pinches) is
  // what actually updates, so read that first and only fall back to the
  // attribute for older versions of the library that don't expose it.
  useEffect(() => {
    if (!arActive) return;
    const node = viewerRef.current;
    if (!node) return;
    let rafId;

    const readScaleParts = () => {
      const live = node.scale;
      if (live && typeof live === "object" &&
          typeof live.x === "number" && typeof live.y === "number" && typeof live.z === "number") {
        return [live.x, live.y, live.z];
      }
      const raw = node.getAttribute("scale");
      if (raw) {
        const parts = raw.split(" ").map(Number);
        if (parts.length === 3 && parts.every(n => !isNaN(n))) return parts;
      }
      return null;
    };

    const poll = () => {
      const parts = readScaleParts();
      if (parts) {
        const wPct = Math.round(parts[0] * 100);
        const hPct = Math.round(parts[1] * 100);
        const dPct = Math.round(parts[2] * 100);
        setSize(s => {
          if (s.width===wPct && s.height===hPct && s.depth===dPct) return s;
          return { width:wPct, height:hPct, depth:dPct };
        });
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [arActive]);

  if (!collection) return <Navigate to="/" replace />;
  if (!product) return <Navigate to={`/collections/${slug}`} replace />;

  // Single handler used by every "Generate" button on the page (page panel
  // Color tab + AR overlay Color tab) — same call, same backend chain.
  const handleGenerate = async () => {
    if (!color || generating) return;
    setGenerating(true);
    setGenerateError("");
    setGenerateStatus("Starting…");
    try {
      const result = await runRecolorChain(
        { productName: product.name, imageUrl: product.img, colorHex: color },
        (status) => setGenerateStatus(status)
      );
      setGeneratedModelUrl(result.modelUrl);
    } catch (e) {
      setGenerateError(e.message || "Something went wrong generating this color. Please try again.");
    } finally {
      setGenerating(false);
      setGenerateStatus("");
    }
  };
  const handleResetGenerated = () => {
    setGeneratedModelUrl(null);
    setGenerateError("");
  };

  const scaleAttr = `${pctToMul(size.width)} ${pctToMul(size.height)} ${pctToMul(size.depth)}`;
  const panelProps = {
    size, setSize, unit, setUnit, color, setColor, product,
    generating, generateStatus, generateError,
    onGenerate: handleGenerate,
    hasGenerated: !!generatedModelUrl,
    onResetGenerated: handleResetGenerated,
  };

  return (
    <section style={{ backgroundColor:colors.cream, paddingTop:48, paddingBottom:64 }}>
      <style>{STYLES}</style>
      <div style={{ maxWidth:980, margin:"0 auto", padding:"0 20px" }}>
        <Link to={`/collections/${slug}`}
          style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, color:colors.textMuted, fontFamily:fontSans, marginBottom:28, textDecoration:"none" }}>
          <ArrowLeftIcon style={{ width:16, height:16 }} />
          Back to {collection.name}
        </Link>

        <div className="product-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:48, alignItems:"start" }}>

          {/* ── Left: viewer + panel ── */}
          <div>
            <model-viewer
              ref={viewerRef}
              src={generatedModelUrl || product.model}
              ios-src={generatedModelUrl ? undefined : product.iosModel}
              alt={`3D model of ${product.name}`}
              ar
              ar-modes="webxr scene-viewer quick-look"
              ar-scale="auto"
              camera-controls
              auto-rotate
              shadow-intensity="1"
              scale={scaleAttr}
              style={{ width:"100%", height:420, backgroundColor:colors.creamAlt, border:`1px solid ${colors.hairline}`, borderRadius:10, display:"block", position:"relative" }}
            >
              {/* AR launch button */}
              <button slot="ar-button"
                style={{ position:"absolute", bottom:12, right:12, padding:"10px 16px", fontSize:13, background:colors.espresso, color:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6, borderRadius:6, fontFamily:fontSans }}>
                <CubeTransparentIcon style={{ width:16, height:16 }} />
                View in your space
              </button>

              {/* AR overlay — Android WebXR only.
                  Must be a child of <model-viewer> to participate in the
                  WebXR DOM overlay. iOS Quick Look cannot host web HTML. */}
              {!onIOS && arActive && (
                <ARPanel {...panelProps} />
              )}
            </model-viewer>

            <p style={{ fontFamily:fontSans, fontSize:12, color:colors.textMuted, marginTop:10, lineHeight:1.6 }}>
              Drag to rotate.{" "}
              {onIOS
                ? "Set size and color below before entering AR. Once placed, pinch to fine-tune."
                : "The panel also appears as an overlay while in AR (Chrome on Android)."}
            </p>

            {/* Pre-AR edit panel — always visible so users can configure
                before tapping "View in your space". On iOS this is the only
                control surface (Quick Look has no overlay API). */}
            <PagePanel {...panelProps} />
          </div>

          {/* ── Right: product info ── */}
          <div>
            <Eyebrow>{collection.tagline}</Eyebrow>
            <h1 style={{ fontFamily:fontSerif, color:colors.text, fontWeight:500, fontSize:clamp("26px","3vw","32px"), lineHeight:1.2, marginBottom:12 }}>
              {product.name}
            </h1>
            <p style={{ fontFamily:fontSans, fontSize:14, color:colors.textMuted, lineHeight:1.75, marginBottom:16 }}>
              {product.description}
            </p>
            <p style={{ fontFamily:fontSans, fontSize:18, fontWeight:700, color:colors.text, marginBottom:32 }}>
              {product.price}
            </p>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <button style={{ padding:"13px 26px", fontSize:14, background:colors.espresso, color:"#fff", border:"none", cursor:"pointer", fontFamily:fontSans, borderRadius:4 }}>
                Request This Piece
              </button>
              <button style={{ padding:"13px 26px", fontSize:14, background:"transparent", color:colors.text, border:`1.5px solid ${colors.text}`, cursor:"pointer", fontFamily:fontSans, borderRadius:4 }}>
                Book Showroom Visit
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// CSS clamp polyfill helper (just passes through since all target browsers support it)
function clamp(min, val, max) { return `clamp(${min}, ${val}, ${max})`; }
