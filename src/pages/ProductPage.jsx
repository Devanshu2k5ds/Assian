import React, { useState, useRef, useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeftIcon, CubeTransparentIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
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

function DimensionSlider({ label, pct, onChange, baseCm, unit }) {
  const currentCm = baseCm * (pct / 100);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-sm" style={{ fontFamily: fontSans, color: colors.text, fontWeight: 600 }}>
          {label}
        </label>
        <span className="text-sm" style={{ fontFamily: fontSans, color: colors.textMuted }}>
          {formatLength(currentCm, unit)}
        </span>
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

export default function ProductPage() {
  const { slug, productSlug } = useParams();
  const collection = collections[slug];
  const product = collection?.products.find((p) => p.slug === productSlug);

  const viewerRef = useRef(null);

  // Width/height/length as a percent of the product's real-world size.
  // 100 = actual size.
  const [size, setSize] = useState({ width: 100, height: 100, depth: 100 });
  const [unit, setUnit] = useState("cm");

  // Only true once the user has actually entered AR (tapped the button and
  // a session started) — the resize panel stays hidden until then.
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

  if (!collection) return <Navigate to="/" replace />;
  if (!product) return <Navigate to={`/collections/${slug}`} replace />;

  const scaleAttr = `${pctToMultiplier(size.width)} ${pctToMultiplier(size.height)} ${pctToMultiplier(size.depth)}`;
  const isDefaultSize = size.width === 100 && size.height === 100 && size.depth === 100;
  const resetSize = () => setSize({ width: 100, height: 100, depth: 100 });

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
              camera-controls
              auto-rotate
              shadow-intensity="1"
              scale={scaleAttr}
              style={{
                width: "100%",
                height: "420px",
                backgroundColor: colors.creamAlt,
                border: `1px solid ${colors.hairline}`,
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
            </model-viewer>
            <p className="text-xs mt-3" style={{ fontFamily: fontSans, color: colors.textMuted }}>
              Drag to rotate. Tap "View in your space" on a supported phone to place this
              piece in your room using AR.
            </p>

            {/* --- Resize sliders — only shown once AR is active -------- */}
            {arActive ? (
              <div className="mt-6 p-5" style={{ backgroundColor: "#fff", border: `1px solid ${colors.hairline}` }}>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <h3 className="text-sm" style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 600 }}>
                    Adjust size
                  </h3>
                  <div className="flex items-center gap-3">
                    {!isDefaultSize && (
                      <button
                        onClick={resetSize}
                        className="inline-flex items-center gap-1 text-xs hover:opacity-70"
                        style={{ fontFamily: fontSans, color: colors.brownDeep }}
                      >
                        <ArrowPathIcon className="h-3.5 w-3.5" />
                        Reset
                      </button>
                    )}
                    <UnitToggle unit={unit} setUnit={setUnit} />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <DimensionSlider
                    label="Width"
                    pct={size.width}
                    baseCm={product.dimensions.width}
                    unit={unit}
                    onChange={(width) => setSize((s) => ({ ...s, width }))}
                  />
                  <DimensionSlider
                    label="Height"
                    pct={size.height}
                    baseCm={product.dimensions.height}
                    unit={unit}
                    onChange={(height) => setSize((s) => ({ ...s, height }))}
                  />
                  <DimensionSlider
                    label="Length"
                    pct={size.depth}
                    baseCm={product.dimensions.depth}
                    unit={unit}
                    onChange={(depth) => setSize((s) => ({ ...s, depth }))}
                  />
                </div>

                <p className="text-xs mt-4 leading-relaxed" style={{ fontFamily: fontSans, color: colors.textMuted }}>
                  Actual size: {formatLength(product.dimensions.width, unit)} ×{" "}
                  {formatLength(product.dimensions.height, unit)} × {formatLength(product.dimensions.depth, unit)}{" "}
                  (W × H × L).
                </p>
              </div>
            ) : (
              <p className="text-xs mt-4 italic" style={{ fontFamily: fontSans, color: colors.textMuted }}>
                Size adjustment appears here once you're viewing this piece in AR.
              </p>
            )}
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
