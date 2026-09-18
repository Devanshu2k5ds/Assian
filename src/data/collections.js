// One entry per homepage category tile. `slug` is the URL segment used
// in /collections/:slug and must match the `slug` set on each tile in
// src/pages/Home.jsx.
//
// Each product now also has:
//   - slug: URL segment for /collections/:slug/:productSlug
//   - model / iosModel: AR model files (see PLACEHOLDER note below)
//   - dimensions: { width, height, depth } in cm — the piece's REAL-WORLD
//     size at 100% scale. ProductPage.jsx uses this as the baseline the
//     width/height/length sliders scale up or down from, and to show the
//     user an actual cm figure instead of a meaningless percentage.
//
// PLACEHOLDER MODELS: every product below points at the same public sample
// model (Google's Astronaut) just so the AR flow works end-to-end. Swap
// `model` and `iosModel` for your own product's .glb/.usdz once you have
// real 3D scans or renders — see the note in ProductPage.jsx. Dimensions
// are realistic placeholders too — replace with your actual product specs.
const PLACEHOLDER_MODEL = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb";
const PLACEHOLDER_IOS_MODEL = "https://modelviewer.dev/shared-assets/models/Astronaut.usdz";

const collections = {
  "sofas-armchairs": {
    slug: "sofas-armchairs",
    name: "Sofas & Armchairs",
    tagline: "Living Room Collection",
    heading: "Seating made for slow evenings.",
    description:
      "Explore our considered sofa and armchair designs, crafted for lasting comfort and tailored to your living room.",
    products: [
      {
        slug: "marlowe-sofa",
        name: "Marlowe Sofa",
        description: "A deep-seated three-seater in brushed linen, built for unhurried afternoons.",
        price: "From ₹1,58,000",
        img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 220, height: 85, depth: 95 },
      },
      {
        slug: "alder-armchair",
        name: "Alder Armchair",
        description: "A compact accent chair with a solid oak frame and a softly rolled arm.",
        price: "From ₹64,000",
        img: "https://images.unsplash.com/photo-1567016432779-094069958ea5?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 75, height: 80, depth: 78 },
      },
      {
        slug: "wren-corner-sofa",
        name: "Wren Corner Sofa",
        description: "A modular corner piece that adapts to your room, upholstered in boucle.",
        price: "From ₹2,10,000",
        img: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 260, height: 85, depth: 160 },
      },
      {
        slug: "hazel-lounge-chair",
        name: "Hazel Lounge Chair",
        description: "A low, sculptural chair with a tapered oak base and generous cushioning.",
        price: "From ₹72,000",
        img: "https://images.unsplash.com/photo-1550254478-ead40cc54513?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 70, height: 75, depth: 80 },
      },
    ],
  },

  "beds-mattresses": {
    slug: "beds-mattresses",
    name: "Beds & Mattresses",
    tagline: "Bedroom Collection",
    heading: "Beds made for a beautiful pause.",
    description:
      "Explore our considered bed designs, crafted for lasting comfort and tailored to your bedroom.",
    products: [
      {
        slug: "aurora-upholstered-bed",
        name: "Aurora Upholstered Bed",
        description: "Softly rounded upholstery and a generous padded headboard for unhurried evenings.",
        price: "From ₹1,28,000",
        img: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 160, height: 110, depth: 210 },
      },
      {
        slug: "siena-platform-bed",
        name: "Siena Platform Bed",
        description: "A low, architectural oak profile with a tailored upholstered surround.",
        price: "From ₹1,46,000",
        img: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 150, height: 90, depth: 205 },
      },
      {
        slug: "elm-canopy-bed",
        name: "Elm Canopy Bed",
        description: "Quiet oak framing meets linen textures in a made-to-measure statement piece.",
        price: "From ₹1,82,000",
        img: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 180, height: 200, depth: 215 },
      },
      {
        slug: "verona-tufted-bed",
        name: "Verona Tufted Bed",
        description: "Deep, tailored comfort with a softly structured silhouette and refined piping.",
        price: "From ₹1,64,000",
        img: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 160, height: 115, depth: 210 },
      },
      {
        slug: "nocturne-panel-bed",
        name: "Nocturne Panel Bed",
        description: "A crisp, contemporary profile with dark oak details and a tailored headboard.",
        price: "From ₹1,72,000",
        img: "https://images.unsplash.com/photo-1616627561950-9f746e330187?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 160, height: 100, depth: 208 },
      },
    ],
  },

  "dining-tables": {
    slug: "dining-tables",
    name: "Dining Tables",
    tagline: "Dining Collection",
    heading: "Tables set for long dinners.",
    description:
      "Explore our considered dining table designs, crafted for gathering and tailored to your space.",
    products: [
      {
        slug: "birch-extending-table",
        name: "Birch Extending Table",
        description: "A solid birch top with a hidden leaf, built to grow with your table.",
        price: "From ₹98,000",
        img: "https://images.unsplash.com/photo-1617806118233-18e1de247200?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 160, height: 75, depth: 90 },
      },
      {
        slug: "faro-round-table",
        name: "Faro Round Table",
        description: "A pedestal-base round table in walnut, sized for everyday and gathering alike.",
        price: "From ₹86,000",
        img: "https://images.unsplash.com/photo-1449247709967-d4461a6a6103?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 120, height: 75, depth: 120 },
      },
      {
        slug: "linden-live-edge-table",
        name: "Linden Live-Edge Table",
        description: "A single live-edge slab, finished to let the natural grain lead.",
        price: "From ₹1,32,000",
        img: "https://images.unsplash.com/photo-1615873968403-89e068629265?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 200, height: 76, depth: 100 },
      },
    ],
  },

  "modular-kitchens": {
    slug: "modular-kitchens",
    name: "Modular Kitchens",
    tagline: "Kitchen Collection",
    heading: "Kitchens planned around how you cook.",
    description:
      "Explore our modular kitchen layouts, planned in 3D and tailored to your walkway and storage needs.",
    products: [
      {
        slug: "oakridge-l-shape-kitchen",
        name: "Oakridge L-Shape Kitchen",
        description: "An L-shaped layout with soft-close oak cabinetry and an integrated breakfast counter.",
        price: "From ₹4,20,000",
        img: "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 300, height: 85, depth: 60 },
      },
      {
        slug: "parallel-line-kitchen",
        name: "Parallel Line Kitchen",
        description: "A galley-style parallel kitchen designed for tight walkways without losing storage.",
        price: "From ₹3,60,000",
        img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 280, height: 85, depth: 60 },
      },
      {
        slug: "island-concept-kitchen",
        name: "Island Concept Kitchen",
        description: "An open island layout built for kitchens that double as the gathering room.",
        price: "From ₹5,80,000",
        img: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 350, height: 90, depth: 120 },
      },
    ],
  },

  "custom-wardrobes": {
    slug: "custom-wardrobes",
    name: "Custom Wardrobes",
    tagline: "Wardrobe Collection",
    heading: "Storage built around what you own.",
    description:
      "Explore our made-to-measure wardrobe systems, planned in 3D and tailored to your room and wardrobe.",
    products: [
      {
        slug: "sliding-panel-wardrobe",
        name: "Sliding Panel Wardrobe",
        description: "Floor-to-ceiling sliding shutters in oak veneer, fitted to your exact wall.",
        price: "From ₹2,40,000",
        img: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 240, height: 240, depth: 60 },
      },
      {
        slug: "walk-in-wardrobe-system",
        name: "Walk-In Wardrobe System",
        description: "A fully planned walk-in layout with open shelving and soft-close drawers.",
        price: "From ₹3,80,000",
        img: "https://images.unsplash.com/photo-1626178793926-22b28830aa30?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 300, height: 240, depth: 400 },
      },
      {
        slug: "hinged-door-wardrobe",
        name: "Hinged Door Wardrobe",
        description: "A classic hinged-door wardrobe with an internal layout planned around your wardrobe.",
        price: "From ₹2,10,000",
        img: "https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 200, height: 220, depth: 60 },
      },
    ],
  },

  "curtains-accent-tables": {
    slug: "curtains-accent-tables",
    name: "Curtains & Accent Tables",
    tagline: "Finishing Touches Collection",
    heading: "The details that finish a room.",
    description:
      "Explore our curtains and accent tables, the considered last layer for a room that's otherwise done.",
    products: [
      {
        slug: "linen-sheer-curtains",
        name: "Linen Sheer Curtains",
        description: "Lightly textured linen sheers that soften daylight without losing it.",
        price: "From ₹8,500",
        img: "https://images.unsplash.com/photo-1616627561950-9f746e330187?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 140, height: 240, depth: 2 },
      },
      {
        slug: "oak-accent-table",
        name: "Oak Accent Table",
        description: "A small side table in solid oak, sized for a lamp, a book, and not much else.",
        price: "From ₹18,000",
        img: "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 45, height: 50, depth: 45 },
      },
      {
        slug: "blackout-drape-set",
        name: "Blackout Drape Set",
        description: "A tailored blackout drape in heavyweight cotton, lined for total dark.",
        price: "From ₹12,500",
        img: "https://images.unsplash.com/photo-1600210492493-0946911123ea?q=80&w=800&auto=format&fit=crop",
        model: PLACEHOLDER_MODEL,
        iosModel: PLACEHOLDER_IOS_MODEL,
        dimensions: { width: 150, height: 260, depth: 3 },
      },
    ],
  },
};

export default collections;
