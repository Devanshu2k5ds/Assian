import React from "react";
import { colors, fontSans } from "../lib/theme";

export default function Eyebrow({ children, dark = false }) {
  return (
    <p
      className="text-xs tracking-widest mb-3"
      style={{
        fontFamily: fontSans,
        color: dark ? colors.textOnDark : colors.brown,
        letterSpacing: "0.14em",
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  );
}
