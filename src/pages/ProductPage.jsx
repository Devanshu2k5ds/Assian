import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeftIcon, CubeTransparentIcon } from "@heroicons/react/24/outline";
import { colors, fontSerif, fontSans } from "../lib/theme";
import Eyebrow from "../components/Eyebrow";
import collections from "../data/collections";

export default function ProductPage() {
  const { slug, productSlug } = useParams();
  const collection = collections[slug];
  const product = collection?.products.find((p) => p.slug === productSlug);

  // Unknown collection or product slug — send back to that collection
  // (or home, if the collection itself doesn't exist) instead of a blank page.
  if (!collection) return <Navigate to="/" replace />;
  if (!product) return <Navigate to={`/collections/${slug}`} replace />;

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
              camera-controls
              auto-rotate
              shadow-intensity="1"
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
              Drag to rotate. On a supported phone, tap "View in your space" to place this
              piece in your room using AR.
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
