import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { colors, fontSerif, fontSans } from "../lib/theme";

const NAV_LINKS = [
  { label: "Living", to: "/collections/sofas-armchairs" },
  { label: "Bedroom", to: "/collections/beds-mattresses" },
  { label: "Dining", to: "/collections/dining-tables" },
  { label: "Kitchens & Wardrobes", to: "/collections/modular-kitchens" },
  { label: "Curtains", to: "/collections/curtains-accent-tables" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="w-full bg-white border-b" style={{ borderColor: colors.hairline }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="text-lg"
          style={{ fontFamily: fontSerif, fontWeight: 600, letterSpacing: "0.03em", color: colors.text }}
        >
          Assian Furniture
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="text-sm hover:opacity-70 transition-opacity"
              style={{ fontFamily: fontSans, color: colors.text }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            className="px-4 py-2 text-sm text-white rounded-sm"
            style={{ fontFamily: fontSans, backgroundColor: colors.espresso }}
          >
            Book Showroom Visit
          </button>
          <button
  className="px-4 py-2 text-sm rounded-sm border"
  style={{ fontFamily: fontSans, borderColor: colors.text, color: colors.text }}
  onClick={() => {
    const phoneNumber = "919056174744"; // Country code + number (no +, spaces, or dashes)
    const defaultMessage = encodeURIComponent("Hello! I would like to get in touch.");
    
    window.open(
      `https://wa.me/${phoneNumber}?text=${defaultMessage}`,
      "_blank",
      "noopener,noreferrer"
    );
  }}
>
  WhatsApp
</button>
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? (
            <XMarkIcon className="h-5 w-5" style={{ color: colors.text }} />
          ) : (
            <Bars3Icon className="h-5 w-5" style={{ color: colors.text }} />
          )}
        </button>
      </div>

      {open && (
        <div className="md:hidden px-6 pb-5 flex flex-col gap-4">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.to} onClick={() => setOpen(false)} style={{ fontFamily: fontSans, color: colors.text }}>
              {link.label}
            </Link>
          ))}
          <button
            className="px-4 py-2 text-sm text-white rounded-sm w-full"
            style={{ fontFamily: fontSans, backgroundColor: colors.espresso }}
          >
            Book Showroom Visit
          </button>
          <button
  className="px-4 py-2 text-sm rounded-sm border"
  style={{ fontFamily: fontSans, borderColor: colors.text, color: colors.text }}
  onClick={() => {
    const phoneNumber = "919056174744"; // Country code + number (no +, spaces, or dashes)
    const defaultMessage = encodeURIComponent("Hello! I would like to get in touch.");
    
    window.open(
      `https://wa.me/${phoneNumber}?text=${defaultMessage}`,
      "_blank",
      "noopener,noreferrer"
    );
  }}
>
  WhatsApp
</button>
        </div>
      )}
    </header>
  );
}
