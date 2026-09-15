import React, { useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeftIcon, CubeTransparentIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { colors, fontSerif, fontSans } from "../lib/theme";
import Eyebrow from "../components/Eyebrow";
import collections from "../data/collections";

// Sliders move in percent-of-actual-size (50%–150%), which is easier for a
// person to reason about than a raw multiplier. This converts a percent
// back to the multiplier model-viewer's `scale` attribute expects.
const pctToMultiplier = (pct) => (pct / 100).toFixed(2);

function DimensionSlider({ label, pct, onChange, baseCm }) {
  const currentCm = Math.round(baseCm * (pct / 100));
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-sm" style={{ fontFamily: fontSans, color: colors.text, fontWeight: 600 }}>
          {label}
        </label>
        <span className="text-sm" style={{ fontFamily: fontSans, color: colors.textMuted }}>
          {currentCm} cm
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

export default function ProductPage() {
  const { slug, productSlug } = useParams();
  const collection = collections[slug];
  const product = collection?.products.find((p) => p.slug === productSlug);

  // Width/height/length as a percent of the product's real-world size.
  // 100 = actual size. Hooks must run before any early return below.
  const [size, setSize] = useState({ width: 100, height: 100, depth: 100 });

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
              piece in your room using AR — it keeps whatever size you set below.
            </p>

            {/* --- Resize sliders ------------------------------------- */}
            <div className="mt-6 p-5" style={{ backgroundColor: "#fff", border: `1px solid ${colors.hairline}` }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm" style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 600 }}>
                  Adjust size
                </h3>
                {!isDefaultSize && (
                  <button
                    onClick={resetSize}
                    className="inline-flex items-center gap-1 text-xs hover:opacity-70"
                    style={{ fontFamily: fontSans, color: colors.brownDeep }}
                  >
                    <ArrowPathIcon className="h-3.5 w-3.5" />
                    Reset to actual size
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <DimensionSlider
                  label="Width"
                  pct={size.width}
                  baseCm={product.dimensions.width}
                  onChange={(width) => setSize((s) => ({ ...s, width }))}
                />
                <DimensionSlider
                  label="Height"
                  pct={size.height}
                  baseCm={product.dimensions.height}
                  onChange={(height) => setSize((s) => ({ ...s, height }))}
                />
                <DimensionSlider
                  label="Length"
                  pct={size.depth}
                  baseCm={product.dimensions.depth}
                  onChange={(depth) => setSize((s) => ({ ...s, depth }))}
                />
              </div>

              <p className="text-xs mt-4 leading-relaxed" style={{ fontFamily: fontSans, color: colors.textMuted }}>
                Actual size: {product.dimensions.width} × {product.dimensions.height} ×{" "}
                {product.dimensions.depth} cm (W × H × L). Dragging a slider scales that axis
                independently, both here and in AR.
              </p>
            </div>
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
