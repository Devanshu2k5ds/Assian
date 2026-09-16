import React, { useState, useRef, useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeftIcon, CubeTransparentIcon, SwatchIcon } from "@heroicons/react/24/outline";
import { colors, fontSerif, fontSans } from "../lib/theme";
import Eyebrow from "../components/Eyebrow";
import collections from "../data/collections";

// Sliders move in percent-of-actual-size (50%–150%), which is easier for a
// person to reason about than a raw multiplier. This converts a percent
// back to the multiplier model-viewer's `scale` attribute expects.
const pctToMultiplier = (pct) => (pct / 100).toFixed(2);

// Formats a cm value in either "cm" or "ft/in" (e.g. 6'11") depending on
// the unit the user has selected.
function formatLength(cm, unit) {
  if (unit === "cm") return `${Math.round(cm)} cm`;
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}' ${inches}"`;
}

// Converts cm to a whole feet + inches pair, and back. Used only by the
// ft/in input boxes below — the range slider itself always operates in
// percent, driven from whichever of these two representations the person
// last edited.
function cmToFeetInches(cm) {
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}
function feetInchesToCm(feet, inches) {
  return (feet * 12 + inches) * 2.54;
}

function DimensionSlider({ label, pct, onChange, baseCm, unit }) {
  const currentCm = baseCm * (pct / 100);
  const minCm = baseCm * 0.5;
  const maxCm = baseCm * 1.5;
  const { feet, inches } = cmToFeetInches(currentCm);

  const setFromCm = (cm) => {
    const clamped = Math.min(maxCm, Math.max(minCm, cm));
    onChange(Math.round((clamped / baseCm) * 100));
  };

  const handleFeetChange = (raw) => {
    const val = parseFloat(raw);
    if (Number.isNaN(val)) return;
    setFromCm(feetInchesToCm(val, inches));
  };
  const handleInchesChange = (raw) => {
    const val = parseFloat(raw);
    if (Number.isNaN(val)) return;
    setFromCm(feetInchesToCm(feet, val));
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 gap-3">
        <label className="text-sm" style={{ fontFamily: fontSans, color: colors.text, fontWeight: 600 }}>
          {label}
        </label>

        {unit === "ft" ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={feet}
              onChange={(e) => handleFeetChange(e.target.value)}
              className="w-12 px-1.5 py-1 text-sm text-right outline-none"
              style={{ fontFamily: fontSans, color: colors.text }}
              aria-label={`${label} feet`}
            />
            <span className="text-xs" style={{ fontFamily: fontSans, color: colors.textMuted }}>
              ft
            </span>
            <input
              type="number"
              value={inches}
              onChange={(e) => handleInchesChange(e.target.value)}
              className="w-12 px-1.5 py-1 text-sm text-right outline-none"
              style={{ fontFamily: fontSans, color: colors.text }}
              aria-label={`${label} inches`}
            />
            <span className="text-xs" style={{ fontFamily: fontSans, color: colors.textMuted }}>
              in
            </span>
          </div>
        ) : (
          <span className="text-sm" style={{ fontFamily: fontSans, color: colors.textMuted }}>
            {Math.round(currentCm)} cm
          </span>
        )}
      </div>
      <input
        type="range"
        min={50}
        max={150}
        step={1}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: colors.espresso }}
      />
    </div>
  );
}

function UnitToggle({ unit, setUnit }) {
  const options = [
    { id: "cm", label: "cm" },
    { id: "ft", label: "ft / in" },
  ];
  return (
    <div className="inline-flex text-xs" style={{ border: `1px solid ${colors.hairline}` }}>
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setUnit(opt.id)}
          className="px-3 py-1.5"
          style={{
            fontFamily: fontSans,
            backgroundColor: unit === opt.id ? colors.espresso : "transparent",
            color: unit === opt.id ? "#fff" : colors.textMuted,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// --- Size panel -------------------------------------------------------------
// Just the three sliders and the unit toggle now — no title, no border, no
// reset, no helper copy. Rendered twice: once always-visible on the page
// (works on iOS, where an in-AR overlay can never appear — Quick Look is a
// native app with no webpage behind it), and once again inside
// <model-viewer> gated on `ar-status` as a bonus for Android/WebXR
// sessions.
function SizePanel({ size, setSize, unit, setUnit, dimensions }) {
  return (
    <div className="p-4">
      <div className="flex justify-end mb-3">
        <UnitToggle unit={unit} setUnit={setUnit} />
      </div>

      <div className="flex flex-col gap-4">
        <DimensionSlider
          label="Width"
          pct={size.width}
          baseCm={dimensions.width}
          unit={unit}
          onChange={(width) => setSize((s) => ({ ...s, width }))}
        />
        <DimensionSlider
          label="Height"
          pct={size.height}
          baseCm={dimensions.height}
          unit={unit}
          onChange={(height) => setSize((s) => ({ ...s, height }))}
        />
        <DimensionSlider
          label="Length"
          pct={size.depth}
          baseCm={dimensions.depth}
          unit={unit}
          onChange={(depth) => setSize((s) => ({ ...s, depth }))}
        />
      </div>
    </div>
  );
}

function ColorSlider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 gap-3">
        <label className="text-sm" style={{ fontFamily: fontSans, color: colors.text, fontWeight: 600 }}>
          {label}
        </label>
        <span className="text-sm" style={{ fontFamily: fontSans, color: colors.textMuted }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={255}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: colors.espresso }}
      />
    </div>
  );
}

// --- Color panel --------------------------------------------------------
// Three RGB sliders + a live swatch, tinting the model's material(s) via
// the effect in ProductPage below. Rendered twice for the same reason as
// SizePanel: once always-visible, once inside the Android-only in-AR
// overlay. Unlike SizePanel this keeps a light hairline border + white
// fill (matching the card treatment already used elsewhere on this site,
// e.g. the Services cards on Home.jsx) — that "no background/border" rule
// was specific to the size panel, not a blanket style for every panel.
function ColorPanel({ color, setColor }) {
  return (
    <div className="p-4" style={{ border: `1px solid ${colors.hairline}`, backgroundColor: "#fff" }}>
      <div className="flex items-center gap-3 mb-4">
        <span
          className="h-9 w-9 rounded-full flex-shrink-0"
          style={{
            backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
            border: `1px solid ${colors.hairline}`,
          }}
        />
        <span className="text-sm" style={{ fontFamily: fontSans, color: colors.textMuted }}>
          rgb({color.r}, {color.g}, {color.b})
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <ColorSlider label="Red" value={color.r} onChange={(r) => setColor((c) => ({ ...c, r }))} />
        <ColorSlider label="Green" value={color.g} onChange={(g) => setColor((c) => ({ ...c, g }))} />
        <ColorSlider label="Blue" value={color.b} onChange={(b) => setColor((c) => ({ ...c, b }))} />
      </div>
    </div>
  );
}

export default function ProductPage() {
  const { slug, productSlug } = useParams();
  const collection = collections[slug];
  const product = collection?.products.find((p) => p.slug === productSlug);

  const viewerRef = useRef(null);

  // Width/height/length as a percent of the product's real-world size.
  // 100 = actual size. This now drives both the on-page 3D preview AND the
  // size the model launches into AR at, since it's set before "View in
  // your space" is ever tapped.
  const [size, setSize] = useState({ width: 100, height: 100, depth: 100 });
  const [unit, setUnit] = useState("cm");

  // RGB tint applied to the model's material(s), 0-255 per channel.
  // {255,255,255} is neutral — it multiplies the model's own color/texture
  // by 1, i.e. no visible change — so that's the default until the person
  // moves a slider.
  const [color, setColor] = useState({ r: 255, g: 255, b: 255 });
  const [colorPanelOpen, setColorPanelOpen] = useState(false);

  // Roll/pitch/yaw in degrees — drives model-viewer's `orientation`
  // attribute, which rotates the model itself (as opposed to camera-orbit,
  // which just moves the viewpoint). Set by finger/mouse drag directly on
  // the viewer below, not by any slider.
  const [rotation, setRotation] = useState({ roll: 0, pitch: 0, yaw: 0 });

  // Tracks active pointers so one finger spins/tips the model (yaw/pitch)
  // and two fingers twist it (roll) — a drag-and-twist gesture in place of
  // camera-controls, which we've turned off since it would otherwise fight
  // these handlers for the same touch events.
  const dragState = useRef({ pointers: new Map(), lastAngle: null });
  const ROTATE_SENSITIVITY = 0.4; // degrees rotated per pixel dragged

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dragState.current.pointers.size === 2) {
      const [a, b] = Array.from(dragState.current.pointers.values());
      dragState.current.lastAngle = Math.atan2(b.y - a.y, b.x - a.x);
    }
  };

  const handlePointerMove = (e) => {
    if (!dragState.current.pointers.has(e.pointerId)) return;
    const prev = dragState.current.pointers.get(e.pointerId);
    const curr = { x: e.clientX, y: e.clientY };
    dragState.current.pointers.set(e.pointerId, curr);

    if (dragState.current.pointers.size === 1) {
      // One finger: spin only — the body stays vertical (no pitch/roll
      // change), so this always reads as "turning it around on the spot"
      // rather than tipping it.
      const dx = curr.x - prev.x;
      setRotation((r) => ({
        ...r,
        yaw: (r.yaw + dx * ROTATE_SENSITIVITY + 360) % 360,
      }));
    } else if (dragState.current.pointers.size === 2) {
      // Two fingers: unlocks tipping it off its vertical axis — dragging
      // up/down tips it forward/back (pitch), twisting the two fingers
      // rolls it side to side. Together these can lay it flat or flip it
      // fully upside down.
      //
      // BUGFIX: each pointermove event only tells us that ONE of the two
      // fingers moved — the other finger's last-known position in the map
      // is unchanged this tick. Since the pair's MIDPOINT is the average
      // of both positions, and only one of them just changed, the
      // midpoint moves by exactly half of that single finger's delta.
      // The previous code used that finger's full raw dy for pitch, so
      // pitch reacted to whichever finger happened to fire the event —
      // meaning a pure twist-in-place around a near-still pivot finger
      // (very natural for a "roll" gesture) injected a large, unwanted
      // pitch change at the same time, which is what made two-finger
      // rotation feel broken/uncontrollable. Halving it here makes pitch
      // track how far the pair moved together instead.
      const dy = (curr.y - prev.y) / 2;
      const [a, b] = Array.from(dragState.current.pointers.values());
      const angle = Math.atan2(b.y - a.y, b.x - a.x);

      setRotation((r) => {
        let next = { ...r, pitch: (r.pitch + dy * ROTATE_SENSITIVITY + 360) % 360 };
        if (dragState.current.lastAngle != null) {
          const deltaDeg = ((angle - dragState.current.lastAngle) * 180) / Math.PI;
          next = { ...next, roll: (next.roll + deltaDeg + 360) % 360 };
        }
        return next;
      });
      dragState.current.lastAngle = angle;
    }
  };

  const handlePointerUp = (e) => {
    dragState.current.pointers.delete(e.pointerId);
    if (dragState.current.pointers.size < 2) dragState.current.lastAngle = null;
  };

  // Only true once a WebXR AR session has actually started (Android
  // Chrome). iOS hands off to native Quick Look, which never fires this
  // the same way and has no DOM overlay support regardless — so this stays
  // false there, and the in-AR panel below simply never renders on iOS.
  // That's expected, not a bug: the always-visible panel above the viewer
  // is what covers iOS.
  const [arActive, setArActive] = useState(false);

  // Hooks must run before any early return below.
  useEffect(() => {
    const node = viewerRef.current;
    if (!node) return;
    const handleArStatus = (event) => {
      const status = event.detail?.status;
      setArActive(status === "session-started" || status === "object-placed");
    };
    node.addEventListener("ar-status", handleArStatus);
    return () => node.removeEventListener("ar-status", handleArStatus);
  }, [product]);

  // Tints the model via model-viewer's material scene-graph API:
  // model.materials[i].pbrMetallicRoughness.setBaseColorFactor([r,g,b,a])
  // (0-1 floats). `model.materials` only exists once the element's "load"
  // event has fired, and — because a fresh `src` doesn't retain a color
  // that was applied to the previous model — this both applies immediately
  // (covers the model already being loaded, e.g. while dragging a slider)
  // and re-applies on every future "load" (covers first paint, and a model
  // swap later on).
  //
  // Platform note: this reliably updates the on-page preview and carries
  // into Android AR (WebXR/Scene Viewer), since both use this same live
  // model. It does NOT carry into iOS Quick Look — confirmed against
  // model-viewer's own scene-graph docs, which state Quick Look doesn't
  // reflect base-color changes because USDZ doesn't support a color
  // multiplied onto a texture. That's a USDZ/iOS platform limitation, the
  // same category of gap as the AR DOM-overlay issue, not something
  // fixable from this file.
  useEffect(() => {
    const node = viewerRef.current;
    if (!node) return;

    const applyColor = () => {
      if (!node.model) return;
      const factor = [color.r / 255, color.g / 255, color.b / 255, 1];
      node.model.materials.forEach((material) => {
        material.pbrMetallicRoughness.setBaseColorFactor(factor);
      });
    };

    applyColor();
    node.addEventListener("load", applyColor);
    return () => node.removeEventListener("load", applyColor);
  }, [color]);

  if (!collection) return <Navigate to="/" replace />;
  if (!product) return <Navigate to={`/collections/${slug}`} replace />;

  const scaleAttr = `${pctToMultiplier(size.width)} ${pctToMultiplier(size.height)} ${pctToMultiplier(size.depth)}`;
  const orientationAttr = `${rotation.roll}deg ${rotation.pitch}deg ${rotation.yaw}deg`;

  return (
    <section className="py-14 md:py-16" style={{ backgroundColor: colors.cream }}>
      <div className="max-w-5xl mx-auto px-6">
        <Link
          to={`/collections/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm mb-8 hover:opacity-70"
          style={{ fontFamily: fontSans, color: colors.textMuted }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to {collection.name}
        </Link>

        <div className="grid md:grid-cols-2 gap-10 md:gap-14">
          {/* --- 3D / AR viewer --------------------------------------- */}
          <div>
            <model-viewer
              ref={viewerRef}
              src={product.model}
              ios-src={product.iosModel}
              alt={`3D model of ${product.name}`}
              ar
              ar-modes="webxr scene-viewer quick-look"
              ar-scale="fixed"
              shadow-intensity="1"
              scale={scaleAttr}
              orientation={orientationAttr}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                width: "100%",
                height: "420px",
                backgroundColor: colors.creamAlt,
                border: `1px solid ${colors.hairline}`,
                touchAction: "none",
              }}
            >
              <button
                slot="ar-button"
                className="absolute bottom-4 right-4 px-4 py-2.5 text-sm text-white inline-flex items-center gap-2"
                style={{ fontFamily: fontSans, backgroundColor: colors.espresso }}
              >
                <CubeTransparentIcon className="h-4 w-4" />
                View in your space
              </button>

              {/* In-AR overlay — only ever appears during a WebXR session
                  (Android Chrome), since that's the only mode with DOM
                  overlay support. Must stay a child of <model-viewer> so
                  it's treated as part of that overlay; absolutely
                  positioned so it doesn't affect the normal preview
                  layout. iOS Quick Look simply never sets arActive true,
                  so this never renders there. Inside AR, rotating the
                  placed object is handled by the native AR session's own
                  finger gestures, not by anything here — so this only
                  needs size. */}
              {arActive && (
                <div
                  className="p-4"
                  style={{
                    position: "absolute",
                    left: 12,
                    right: 12,
                    bottom: 12,
                    maxHeight: "calc(100% - 24px)",
                    overflowY: "auto",
                    pointerEvents: "auto",
                  }}
                >
                  <SizePanel size={size} setSize={setSize} unit={unit} setUnit={setUnit} dimensions={product.dimensions} />

                  <div className="mt-3">
                    <button
                      onClick={() => setColorPanelOpen((v) => !v)}
                      className="px-4 py-2 text-sm border inline-flex items-center gap-2"
                      style={{ fontFamily: fontSans, borderColor: colors.text, color: colors.text, backgroundColor: "#fff" }}
                    >
                      <SwatchIcon className="h-4 w-4" />
                      {colorPanelOpen ? "Hide Color Panel" : "Change Color"}
                    </button>
                    {colorPanelOpen && (
                      <div className="mt-3">
                        <ColorPanel color={color} setColor={setColor} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </model-viewer>

            {/* Always-visible panel — this is what makes size work on
                iOS, and lets everyone set it up before AR even starts.
                The live 3D preview above updates as you drag. */}
            <div className="mt-4">
              <SizePanel size={size} setSize={setSize} unit={unit} setUnit={setUnit} dimensions={product.dimensions} />
            </div>

            <div className="mt-3">
              <button
                onClick={() => setColorPanelOpen((v) => !v)}
                className="px-4 py-2 text-sm border inline-flex items-center gap-2"
                style={{ fontFamily: fontSans, borderColor: colors.text, color: colors.text }}
              >
                <SwatchIcon className="h-4 w-4" />
                {colorPanelOpen ? "Hide Color Panel" : "Change Color"}
              </button>
              {colorPanelOpen && (
                <div className="mt-3">
                  <ColorPanel color={color} setColor={setColor} />
                </div>
              )}
            </div>

            <p className="text-xs mt-3" style={{ fontFamily: fontSans, color: colors.textMuted }}>
              One finger spins it in place. Two fingers tip and roll it — all the way upside down
              if you like. Set your size above, then tap "View in your space."
            </p>

            <p className="text-xs mt-2 leading-relaxed" style={{ fontFamily: fontSans, color: colors.textMuted }}>
              Actual size: {formatLength(product.dimensions.width, unit)} ×{" "}
              {formatLength(product.dimensions.height, unit)} × {formatLength(product.dimensions.depth, unit)} (W ×
              H × L).
            </p>
          </div>

          {/* --- Product details ---------------------------------------- */}
          <div>
            <Eyebrow>{collection.tagline}</Eyebrow>
            <h1 className="text-3xl mb-3" style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 500 }}>
              {product.name}
            </h1>
            <p className="text-sm leading-relaxed mb-4" style={{ fontFamily: fontSans, color: colors.textMuted }}>
              {product.description}
            </p>
            <p className="text-lg mb-8" style={{ fontFamily: fontSans, color: colors.text, fontWeight: 600 }}>
              {product.price}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="px-6 py-3 text-sm text-white"
                style={{ fontFamily: fontSans, backgroundColor: colors.espresso }}
              >
                Request This Piece
              </button>
              <button
                className="px-6 py-3 text-sm border"
                style={{ fontFamily: fontSans, borderColor: colors.text, color: colors.text }}
              >
                Book Showroom Visit
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
