import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PencilIcon, CubeIcon, TruckIcon } from "@heroicons/react/24/outline";
import { colors, fontSerif, fontSans } from "../lib/theme";
import Eyebrow from "../components/Eyebrow";
import collections from "../data/collections";

// Order + thumbnail image for each homepage tile. `slug` must match a key
// in src/data/collections.js so the tile links to the right detail page.
const CATEGORY_TILES = [
  {
    slug: "sofas-armchairs",
    name: "Sofas & Armchairs",
    img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=800&auto=format&fit=crop",
  },
  {
    slug: "beds-mattresses",
    name: "Beds & Mattresses",
    img: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop",
  },
  {
    slug: "dining-tables",
    name: "Dining Tables",
    img: "https://images.unsplash.com/photo-1617806118233-18e1de247200?q=80&w=800&auto=format&fit=crop",
  },
  {
    slug: "modular-kitchens",
    name: "Modular Kitchens",
    img: "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?q=80&w=800&auto=format&fit=crop",
  },
  {
    slug: "custom-wardrobes",
    name: "Custom Wardrobes",
    img: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=800&auto=format&fit=crop",
  },
  {
    slug: "curtains-accent-tables",
    name: "Curtains & Accent Tables",
    img: "https://images.unsplash.com/photo-1616627561950-9f746e330187?q=80&w=800&auto=format&fit=crop",
  },
];

const SERVICES = [
  {
    icon: PencilIcon,
    title: "Custom Furniture Design",
    body: "Made-to-measure pieces tailored to your proportions, materials and daily rituals.",
  },
  {
    icon: CubeIcon,
    title: "3D Kitchen & Wardrobe Planning",
    body: "Plan every cabinet, finish and walkway before your project begins.",
  },
  {
    icon: TruckIcon,
    title: "White-Glove Delivery & Installation",
    body: "A careful final chapter — delivered, placed and finished by our in-home team.",
  },
];

function Hero() {
  return (
    <section className="relative">
      <div className="relative h-[560px] md:h-[640px] w-full overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1800&auto=format&fit=crop"
          alt="Living room styled by Atelier Oak"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute left-6 right-6 md:left-16 top-1/2 -translate-y-1/2 md:right-auto md:w-[440px] p-8"
          style={{ backgroundColor: "rgba(30,25,19,0.72)" }}
        >
          <Eyebrow dark>Crafted for the way you live</Eyebrow>
          <h1
            className="text-3xl md:text-[2.6rem] leading-tight mb-4"
            style={{ fontFamily: fontSerif, color: "#fff", fontWeight: 500 }}
          >
            Elevate Your Living Space
          </h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ fontFamily: fontSans, color: colors.textOnDark }}>
            Luxury-crafted furniture, bespoke cabinetry and considered details, made to
            bring a quieter kind of beauty home.
          </p>
          <div className="flex gap-3">
            <button
              className="px-5 py-2.5 text-sm rounded-sm text-white"
              style={{ fontFamily: fontSans, backgroundColor: colors.espresso }}
            >
              Explore
            </button>
            <button
              className="px-5 py-2.5 text-sm rounded-sm border text-white"
              style={{ fontFamily: fontSans, borderColor: "#fff" }}
            >
              Visit Our Showroom
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryGrid() {
  return (
    <section className="py-16 md:py-20" style={{ backgroundColor: colors.cream }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <Eyebrow>Furniture, considered</Eyebrow>
          <h2 className="text-3xl md:text-4xl" style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 500 }}>
            Every room, beautifully resolved.
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORY_TILES.map((cat) => (
            <Link
              key={cat.slug}
              to={`/collections/${cat.slug}`}
              className="relative h-56 md:h-64 overflow-hidden group block text-left"
            >
              <img
                src={cat.img}
                alt={cat.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(20,15,10,0.65), rgba(20,15,10,0) 55%)" }}
              />
              <span
                className="absolute bottom-4 left-4 text-white text-sm md:text-base"
                style={{ fontFamily: fontSans, fontWeight: 500 }}
              >
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section className="py-16 md:py-20" style={{ backgroundColor: colors.creamAlt }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <Eyebrow>From our workshop to your home</Eyebrow>
          <h2 className="text-3xl md:text-4xl" style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 500 }}>
            The details are our service.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {SERVICES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white p-7" style={{ border: `1px solid ${colors.hairline}` }}>
              <Icon className="h-8 w-8 mb-5" style={{ color: colors.brownDeep }} strokeWidth={1.5} />
              <h3 className="text-lg mb-2" style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 600 }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ fontFamily: fontSans, color: colors.textMuted }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ConsultationCTA() {
  const [form, setForm] = useState({ name: "", phone: "", date: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section className="py-16 md:py-20" style={{ backgroundColor: colors.tan }}>
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div>
          <Eyebrow>Complimentary design service</Eyebrow>
          <h2
            className="text-3xl md:text-[2.3rem] leading-tight mb-5"
            style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 500 }}
          >
            See your kitchen or wardrobe before it's made.
          </h2>
          <p className="text-sm leading-relaxed max-w-md" style={{ fontFamily: fontSans, color: colors.text }}>
            Bring your measurements, moodboard or a simple idea. Our designers will
            translate it into a tailored 3D concept for your space.
          </p>
        </div>

        <div className="bg-white p-8" style={{ maxWidth: 420, marginLeft: "auto", width: "100%" }}>
          <h3 className="text-lg mb-5" style={{ fontFamily: fontSerif, color: colors.text, fontWeight: 600 }}>
            Request your 3D consultation
          </h3>

          {submitted ? (
            <p style={{ fontFamily: fontSans, color: colors.brownDeep }} className="text-sm">
              Thanks — we've received your request and will call you shortly to confirm your visit.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs block mb-1.5" style={{ fontFamily: fontSans, color: colors.textMuted }}>
                  Your name
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange("name")}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2.5 text-sm outline-none"
                  style={{ fontFamily: fontSans, border: `1px solid ${colors.hairline}`, color: colors.text }}
                />
              </div>
              <div>
                <label className="text-xs block mb-1.5" style={{ fontFamily: fontSans, color: colors.textMuted }}>
                  Phone number
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={handleChange("phone")}
                  placeholder="Enter your phone number"
                  className="w-full px-3 py-2.5 text-sm outline-none"
                  style={{ fontFamily: fontSans, border: `1px solid ${colors.hairline}`, color: colors.text }}
                />
              </div>
              <div>
                <label className="text-xs block mb-1.5" style={{ fontFamily: fontSans, color: colors.textMuted }}>
                  Preferred visit date
                </label>
                <input
                  type="text"
                  value={form.date}
                  onChange={handleChange("date")}
                  placeholder="dd-mm-yyyy"
                  className="w-full px-3 py-2.5 text-sm outline-none"
                  style={{ fontFamily: fontSans, border: `1px solid ${colors.hairline}`, color: colors.text }}
                />
              </div>
              <button
                type="submit"
                className="mt-2 px-5 py-3 text-sm text-white"
                style={{ fontFamily: fontSans, backgroundColor: colors.espresso }}
              >
                Request Consultation
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <CategoryGrid />
      <Services />
      <ConsultationCTA />
    </>
  );
}
