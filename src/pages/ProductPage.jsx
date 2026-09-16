import React, { useState, useRef, useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeftIcon, CubeTransparentIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { colors, fontSerif, fontSans } from "../lib/theme";
import Eyebrow from "../components/Eyebrow";
import collections from "../data/collections";

const pctToMultiplier = (pct) => (pct / 100).toFixed(2);

function formatLength(cm, unit) {
  if (unit === "cm") return `${Math.round(cm)} cm`;
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches === 12) { feet += 1; inches = 0; }
  return `${feet}' ${inches}"`;
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

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}else{
    const d=max-min;
    s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}
  }
  return [Math.round(h*360),Math.round(s*100),Math.round(l*100)];
}

function hslToHex(h,s,l) {
  s/=100; l/=100;
  const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12;const color=l-a*Math.max(Math.min(k-3,9-k,1),-1);return Math.round(255*color).toString(16).padStart(2,'0');};
  return `#${f(0)}${f(8)}${f(4)}`;
}

const PRESETS = [
  { name:"Oak",     hex:"#b58a5a" },
  { name:"Walnut",  hex:"#5c3a21" },
  { name:"Charcoal",hex:"#3a3a3a" },
  { name:"Cream",   hex:"#f0e6d2" },
  { name:"Sage",    hex:"#8a9a7b" },
  { name:"Rust",    hex:"#a85434" },
];

// ─── Styles ──────────────────────────────────────────────────────────────────
const STYLES = `
  .ao-range{-webkit-appearance:none;appearance:none;width:100%;height:4px;background:rgba(60,42,30,0.18);border-radius:999px;outline:none;}
  .ao-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#3C2A1E;border:3px solid #fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.25);margin-top:-8px;}
  .ao-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;}
  .ao-range::-moz-range-track{background:rgba(60,42,30,0.18);height:4px;border-radius:999px;}
  .ao-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#3C2A1E;border:3px solid #fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.25);}
  .ao-seg{display:inline-flex;border-radius:6px;overflow:hidden;border:1.5px solid #E4DBC9;}
  .ao-seg-btn{padding:5px 14px;font-size:12px;font-family:'Inter',sans-serif;cursor:pointer;transition:background 0.15s,color 0.15s;}
  .ao-seg-btn.active{background:#3C2A1E;color:#fff;}
  .ao-seg-btn:not(.active){background:transparent;color:#6E6355;}
  .ao-color-swatch{width:28px;height:28px;border-radius:50%;cursor:pointer;border:2.5px solid transparent;transition:border-color 0.15s;box-shadow:0 1px 3px rgba(0,0,0,0.2);}
  .ao-color-swatch.selected,.ao-color-swatch:hover{border-color:#3C2A1E;}
  .ao-hex-input{flex:1;padding:7px 10px;font-size:13px;font-family:'Inter',sans-serif;border:1.5px solid #E4DBC9;border-radius:6px;outline:none;color:#2B241D;background:#fff;}
  .ao-wheel-wrap{position:relative;width:120px;height:120px;flex-shrink:0;}
  .ao-wheel-canvas{border-radius:50%;cursor:crosshair;touch-action:none;}
  .ao-lightness-track{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:999px;outline:none;cursor:pointer;}
  .ao-lightness-track::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #ccc;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.3);}
  .ao-lightness-track::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #ccc;cursor:pointer;}
  .ar-panel-overlay{position:absolute;left:10px;right:10px;bottom:10px;padding:14px;background:rgba(255,255,255,0.22);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.45);border-radius:12px;pointer-events:auto;}
  .ao-page-panel{margin-top:20px;padding:20px;background:rgba(255,255,255,0.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1.5px solid #E4DBC9;border-radius:10px;}
`;

// ─── RGB Wheel ────────────────────────────────────────────────────────────────
function RGBWheel({ color, onChange }) {
  const canvasRef = useRef(null);
  const dragging = useRef(false);
  const [hsl, setHsl] = useState(() => hexToHsl(color || "#b58a5a"));

  useEffect(() => { setHsl(hexToHsl(color || "#b58a5a")); }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cx = 60, cy = 60, r = 58;
    ctx.clearRect(0, 0, 120, 120);
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = ((angle - 1) * Math.PI) / 180;
      const endAngle = ((angle + 1) * Math.PI) / 180;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `hsl(${angle},0%,${hsl[2]}%)`);
      grad.addColorStop(1, `hsl(${angle},100%,${hsl[2]}%)`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    // cursor dot
    const dotAngle = (hsl[0] * Math.PI) / 180;
    const dotR = (hsl[1] / 100) * r;
    const dx = cx + dotR * Math.cos(dotAngle);
    const dy = cy - dotR * Math.sin(dotAngle);
    ctx.beginPath();
    ctx.arc(dx, dy, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#3C2A1E";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [hsl]);

  const pickColor = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left - 60;
    const y = clientY - rect.top - 60;
    const angle = Math.round((Math.atan2(-y, x) * 180) / Math.PI + 360) % 360;
    const dist = Math.min(Math.sqrt(x * x + y * y), 58);
    const sat = Math.round((dist / 58) * 100);
    const newHsl = [angle, sat, hsl[2]];
    setHsl(newHsl);
    onChange(hslToHex(...newHsl));
  };

  const onMouseDown = (e) => { dragging.current = true; pickColor(e, canvasRef.current); };
  const onMouseMove = (e) => { if (dragging.current) pickColor(e, canvasRef.current); };
  const onMouseUp = () => { dragging.current = false; };
  const onTouchStart = (e) => { e.preventDefault(); dragging.current = true; pickColor(e, canvasRef.current); };
  const onTouchMove = (e) => { e.preventDefault(); if (dragging.current) pickColor(e, canvasRef.current); };

  const lightGrad = `linear-gradient(to right, hsl(${hsl[0]},${hsl[1]}%,5%), hsl(${hsl[0]},${hsl[1]}%,50%), hsl(${hsl[0]},${hsl[1]}%,95%))`;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
      <div className="ao-wheel-wrap">
        <canvas
          ref={canvasRef}
          className="ao-wheel-canvas"
          width={120}
          height={120}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
        />
      </div>
      <div style={{ width:"100%", padding:"0 4px" }}>
        <div style={{ fontSize:11, color:colors.textMuted, fontFamily:fontSans, marginBottom:4 }}>Lightness</div>
        <input
          type="range"
          className="ao-lightness-track"
          min={5} max={95} value={hsl[2]}
          style={{ background: lightGrad }}
          onChange={(e) => {
            const newHsl = [hsl[0], hsl[1], Number(e.target.value)];
            setHsl(newHsl);
            onChange(hslToHex(...newHsl));
          }}
        />
      </div>
    </div>
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────
function Seg({ options, value, onChange }) {
  return (
    <div className="ao-seg">
      {options.map(o => (
        <button key={o.id} className={`ao-seg-btn ${value===o.id?"active":""}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Dimension slider ─────────────────────────────────────────────────────────
function DimSlider({ label, pct, onChange, baseCm, unit }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, alignItems:"baseline" }}>
        <span style={{ fontFamily:fontSans, fontSize:13, fontWeight:600, color:colors.text }}>{label}</span>
        <span style={{ fontFamily:fontSans, fontSize:13, color:colors.textMuted }}>
          {formatLength(baseCm*(pct/100), unit)}
        </span>
      </div>
      <input
        type="range"
        className="ao-range"
        min={50} max={150} step={1}
        value={pct}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// ─── Size tab ─────────────────────────────────────────────────────────────────
function SizeTab({ size, setSize, unit, setUnit, product }) {
  const isDefault = size.width===100 && size.height===100 && size.depth===100;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <Seg
          options={[{id:"cm",label:"cm"},{id:"ft",label:"ft/in"}]}
          value={unit}
          onChange={setUnit}
        />
        {!isDefault && (
          <button
            onClick={() => setSize({width:100,height:100,depth:100})}
            style={{ fontFamily:fontSans, fontSize:12, color:colors.brownDeep, display:"flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer" }}
          >
            <ArrowPathIcon style={{ width:13, height:13 }} /> Reset
          </button>
        )}
      </div>
      <DimSlider label="Width"  pct={size.width}  baseCm={product.dimensions.width}  unit={unit} onChange={w => setSize(s=>({...s,width:w}))} />
      <DimSlider label="Height" pct={size.height} baseCm={product.dimensions.height} unit={unit} onChange={h => setSize(s=>({...s,height:h}))} />
      <DimSlider label="Length" pct={size.depth}  baseCm={product.dimensions.depth}  unit={unit} onChange={d => setSize(s=>({...s,depth:d}))} />
    </div>
  );
}

// ─── Color tab ────────────────────────────────────────────────────────────────
function ColorTab({ color, setColor }) {
  const [hex, setHex] = useState(color || "#b58a5a");
  const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

  const apply = (h) => { setHex(h); setColor(h); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:fontSans, fontSize:12, color:colors.textMuted }}>Choose a finish</span>
        {color && (
          <button
            onClick={() => { setColor(null); }}
            style={{ fontFamily:fontSans, fontSize:12, color:colors.brownDeep, display:"flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer" }}
          >
            <ArrowPathIcon style={{ width:13, height:13 }} /> Reset
          </button>
        )}
      </div>

      <RGBWheel color={hex} onChange={apply} />

      {/* Hex text input */}
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <div style={{ width:28, height:28, borderRadius:"50%", background:hex, border:"2px solid #E4DBC9", flexShrink:0 }} />
        <input
          className="ao-hex-input"
          type="text"
          value={hex}
          placeholder="#b58a5a"
          maxLength={7}
          onChange={e => {
            const val = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setHex(e.target.value);
            if (HEX_RE.test(val)) apply(val);
          }}
        />
      </div>

      {/* Presets */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {PRESETS.map(p => (
          <button
            key={p.hex}
            title={p.name}
            className={`ao-color-swatch ${hex===p.hex?"selected":""}`}
            style={{ backgroundColor:p.hex }}
            onClick={() => apply(p.hex)}
            aria-label={p.name}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main panel (tabs + content) ──────────────────────────────────────────────
function Panel({ activeTab, setActiveTab, size, setSize, unit, setUnit, color, setColor, product }) {
  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <Seg
          options={[{id:"size",label:"Size"},{id:"color",label:"Color"}]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>
      {activeTab==="size"
        ? <SizeTab size={size} setSize={setSize} unit={unit} setUnit={setUnit} product={product} />
        : <ColorTab color={color} setColor={setColor} />}
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

  const [activeTab, setActiveTab] = useState("size");
  const [size, setSize] = useState({ width:100, height:100, depth:100 });
  const [unit, setUnit] = useState("cm");
  const [color, setColor] = useState(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [arActive, setArActive] = useState(false);
  const onIOS = isIOS();

  useEffect(() => {
    const node = viewerRef.current;
    if (!node) return;
    const handleAr = e => {
      const s = e.detail?.status;
      setArActive(s==="session-started" || s==="object-placed");
    };
    const handleLoad = () => {
      const mats = node.model?.materials || [];
      origFactors.current = mats.map(m => [...m.pbrMetallicRoughness.baseColorFactor]);
      setModelLoaded(true);
    };
    node.addEventListener("ar-status", handleAr);
    node.addEventListener("load", handleLoad);
    return () => { node.removeEventListener("ar-status", handleAr); node.removeEventListener("load", handleLoad); };
  }, [product]);

  useEffect(() => {
    const node = viewerRef.current;
    if (!node || !modelLoaded) return;
    const mats = node.model?.materials || [];
    if (color) {
      const rgba = hexToRgb01(color);
      mats.forEach(m => m.pbrMetallicRoughness.setBaseColorFactor(rgba));
    } else {
      mats.forEach((m,i) => { if (origFactors.current[i]) m.pbrMetallicRoughness.setBaseColorFactor(origFactors.current[i]); });
    }
  }, [color, modelLoaded]);

  if (!collection) return <Navigate to="/" replace />;
  if (!product) return <Navigate to={`/collections/${slug}`} replace />;

  const scaleAttr = `${pctToMultiplier(size.width)} ${pctToMultiplier(size.height)} ${pctToMultiplier(size.depth)}`;
  const panelProps = { activeTab, setActiveTab, size, setSize, unit, setUnit, color, setColor, product };

  return (
    <section style={{ backgroundColor:colors.cream, paddingTop:56, paddingBottom:56 }}>
      <style>{STYLES}</style>
      <div style={{ maxWidth:960, margin:"0 auto", padding:"0 24px" }}>
        <Link
          to={`/collections/${slug}`}
          style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:13, color:colors.textMuted, fontFamily:fontSans, marginBottom:32, textDecoration:"none" }}
        >
          <ArrowLeftIcon style={{ width:16, height:16 }} />
          Back to {collection.name}
        </Link>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:56, alignItems:"start" }}>
          {/* 3D viewer */}
          <div>
            <model-viewer
              ref={viewerRef}
              src={product.model}
              ios-src={product.iosModel}
              alt={`3D model of ${product.name}`}
              ar
              ar-modes="webxr scene-viewer quick-look"
              camera-controls
              auto-rotate
              shadow-intensity="1"
              scale={scaleAttr}
              style={{ width:"100%", height:420, backgroundColor:colors.creamAlt, border:`1px solid ${colors.hairline}`, borderRadius:8, display:"block" }}
            >
              <button
                slot="ar-button"
                style={{ position:"absolute", bottom:12, right:12, padding:"10px 16px", fontSize:13, background:colors.espresso, color:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6, borderRadius:4, fontFamily:fontSans }}
              >
                <CubeTransparentIcon style={{ width:16, height:16 }} />
                View in your space
              </button>

              {/* in-AR overlay — Android WebXR only */}
              {!onIOS && arActive && (
                <div className="ar-panel-overlay">
                  <Panel {...panelProps} />
                </div>
              )}
            </model-viewer>

            <p style={{ fontFamily:fontSans, fontSize:12, color:colors.textMuted, marginTop:10, lineHeight:1.5 }}>
              Drag to rotate.
              {onIOS
                ? " Set your size and color below first — once placed in AR, pinch to fine-tune size."
                : " The panel below also appears as an overlay while in AR (Chrome/Android)."}
            </p>

            {/* always-visible page panel */}
            {(onIOS || !arActive) && (
              <div className="ao-page-panel">
                <Panel {...panelProps} />
              </div>
            )}
          </div>

          {/* Product details */}
          <div>
            <Eyebrow>{collection.tagline}</Eyebrow>
            <h1 style={{ fontFamily:fontSerif, color:colors.text, fontWeight:500, fontSize:30, marginBottom:12 }}>
              {product.name}
            </h1>
            <p style={{ fontFamily:fontSans, fontSize:14, color:colors.textMuted, lineHeight:1.7, marginBottom:16 }}>
              {product.description}
            </p>
            <p style={{ fontFamily:fontSans, fontSize:18, color:colors.text, fontWeight:600, marginBottom:32 }}>
              {product.price}
            </p>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <button style={{ padding:"12px 24px", fontSize:14, background:colors.espresso, color:"#fff", border:"none", cursor:"pointer", fontFamily:fontSans }}>
                Request This Piece
              </button>
              <button style={{ padding:"12px 24px", fontSize:14, background:"transparent", color:colors.text, border:`1px solid ${colors.text}`, cursor:"pointer", fontFamily:fontSans }}>
                Book Showroom Visit
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
