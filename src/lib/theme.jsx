import React from "react";

// ---- Design tokens (Atelier Oak) --------------------------------------
export const colors = {
  cream: "#F8F4EC",
  creamAlt: "#F3EDE1",
  tan: "#CFAE89",
  brown: "#8A5A34",
  brownDeep: "#6B4527",
  espresso: "#3C2A1E",
  ink: "#1E1A16",
  text: "#2B241D",
  textMuted: "#6E6355",
  textOnDark: "#EDE7DC",
  hairline: "#E4DBC9",
};

export const fontSerif = "'Fraunces', 'Georgia', serif";
export const fontSans = "'Inter', 'Helvetica Neue', Arial, sans-serif";

export const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
  `}</style>
);
