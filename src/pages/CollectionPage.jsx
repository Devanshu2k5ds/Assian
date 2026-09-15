import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { colors, fontSerif, fontSans } from "../lib/theme";
import Eyebrow from "../components/Eyebrow";
import collections from "../data/collections";

export default function CollectionPage() {
  const { slug } = useParams();
  const collection = collections[slug];

  // Unknown slug (typo'd URL, renamed category, etc.) — send back home
  // instead of rendering a blank page.
  if (!collection) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="py-14 md:py-16" style={{ backgroundColor: colors.cream }}>
      <div className="max-w-6xl mx-auto px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm mb-8 hover:opacity-70"
          style={{ fontFamily: fontSans, color: colors.textMuted }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to all collections
        </Link>

        <Eyebrow>{collection.tagline}</Eyebrow>
        <h1
          className="text-3xl md:text-4xl mb-3 max-w-2xl"
          style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 500 }}
        >
          {collection.heading}
        </h1>
        <p className="text-sm max-w-lg mb-10" style={{ fontFamily: fontSans, color: colors.textMuted }}>
          {collection.description}
        </p>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 mb-16">
          {collection.products.map((product) => (
            <Link key={product.slug} to={`/collections/${slug}/${product.slug}`} className="block group">
              <div className="h-56 overflow-hidden mb-4">
                <img
                  src={product.img}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <h3 className="text-base mb-1.5" style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 600 }}>
                {product.name}
              </h3>
              <p className="text-sm leading-relaxed mb-2" style={{ fontFamily: fontSans, color: colors.textMuted }}>
                {product.description}
              </p>
              <p className="text-sm" style={{ fontFamily: fontSans, color: colors.text, fontWeight: 600 }}>
                {product.price}
              </p>
            </Link>
          ))}
        </div>

        <div
          className="p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
          style={{ backgroundColor: colors.tan }}
        >
          <div>
            <h2 className="text-2xl mb-2" style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 500 }}>
              See the textures in person.
            </h2>
            <p className="text-sm" style={{ fontFamily: fontSans, color: colors.text }}>
              Book a relaxed showroom visit to compare finishes, fabrics and proportions.
            </p>
          </div>
          <button
            className="px-6 py-3 text-sm text-white whitespace-nowrap self-start md:self-auto"
            style={{ fontFamily: fontSans, backgroundColor: colors.espresso }}
          >
            Book Showroom Visit
          </button>
        </div>
      </div>
    </section>
  );
}
