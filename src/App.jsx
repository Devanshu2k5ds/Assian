import React from "react";
import { Routes, Route } from "react-router-dom";
import { colors, FontImport } from "./lib/theme";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ARChatbot from "./components/ARChatbot";
import Home from "./pages/Home";
import CollectionPage from "./pages/CollectionPage";
import ProductPage from "./pages/ProductPage";

export default function App() {
  return (
    <div style={{ backgroundColor: colors.cream }}>
      <FontImport />
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/collections/:slug" element={<CollectionPage />} />
        <Route path="/collections/:slug/:productSlug" element={<ProductPage />} />
      </Routes>

      <Footer />

      {/* Global AR chatbot — floats over every page */}
      <ARChatbot />
    </div>
  );
}
