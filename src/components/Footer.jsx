import React from "react";
import { MapPinIcon } from "@heroicons/react/24/outline";
import { colors, fontSerif, fontSans } from "../lib/theme";

export default function Footer() {
  return (
    <footer style={{ backgroundColor: colors.ink }} className="pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-10 mb-12">
        <div>
          <h4 className="text-lg mb-3" style={{ fontFamily: fontSerif, color: "#fff", fontWeight: 600 }}>
            Assian Furniture
          </h4>
          <p className="text-sm leading-relaxed" style={{ fontFamily: fontSans, color: colors.textOnDark }}>
            Furniture and Interiors designed around the everyday rituals that make a home
            yours.
          </p>
        </div>

        <div>
          <h5 className="text-sm mb-3" style={{ fontFamily: fontSans, color: "#fff", fontWeight: 600 }}>
            Visit the showroom
          </h5>
          <p className="text-sm leading-relaxed mb-2" style={{ fontFamily: fontSans, color: colors.textOnDark }}>
            Amrik Singh Rd
            <br />
            Bathinda, Punjab 151001
          </p>
          <a
            href="https://maps.app.goo.gl/w2sjTDXxyGmAfN1D7"
            className="text-sm inline-flex items-center gap-1.5 hover:opacity-80"
            style={{ fontFamily: fontSans, color: colors.tan }}
          >
            <MapPinIcon className="h-4 w-4" />
            Open in Google Maps
          </a>
        </div>

        <div>
          <h5 className="text-sm mb-3" style={{ fontFamily: fontSans, color: "#fff", fontWeight: 600 }}>
            Showroom hours
          </h5>
          <p className="text-sm leading-relaxed" style={{ fontFamily: fontSans, color: colors.textOnDark }}>
            Monday–Saturday 10am–7pm
            <br />
            Sunday 11am–5pm
          </p>
        </div>

        <div>
          <h5 className="text-sm mb-3" style={{ fontFamily: fontSans, color: "#fff", fontWeight: 600 }}>
            Let's talk
          </h5>
          <p className="text-sm leading-relaxed mb-4" style={{ fontFamily: fontSans, color: colors.textOnDark }}>
            +91 9056174744
            <br />
            assianfurniture@gmail.com
          </p>
        </div>
      </div>

      <div
        className="max-w-7xl mx-auto px-6 pt-6 text-xs flex justify-between"
        style={{ borderTop: `1px solid rgba(255,255,255,0.1)`, fontFamily: fontSans, color: colors.textMuted }}
      >
        <span>© 2026 Assian Furniture. Crafted in India.</span>
      </div>
    </footer>
  );
}
