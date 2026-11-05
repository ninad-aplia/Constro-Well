/**
 * Mock catalogue — transcribed verbatim from buildgrid-shop.html (RAW, ART, HUE,
 * SLIDES, seller-offer synthesis, FBT pairing). Words, names, prices, specs and
 * stock counts are the prototype's, not invented; the owner approves mock copy
 * from that file only.
 *
 * Swap point: when TASK 2.1/2.2 land (Prisma schema + seed), this file is
 * replaced by the seeded database. UI code imports ONLY `src/lib/api/catalog`.
 */

import { CATEGORIES, type Category, type Product, type SellerOffer } from "@/lib/shop/types";

type Row = [name: string, brand: string, mrp: number, price: number, unit: string, rating: number, reviews: number, stock: number, days: number, specs: string[]];

const RAW: Record<Category, Row[]> = {
  Cement: [
    ["UltraBuild OPC 53 Grade Cement, 50 kg Bag", "UltraBuild", 460, 390, "50 kg bag", 4.6, 12840, 420, 1, ["Grade: OPC 53", "Initial setting time: 30 minutes", "Best for: slabs, columns and beams"]],
    ["Rajdhani PPC Cement, 50 kg Bag", "Rajdhani", 430, 365, "50 kg bag", 4.4, 8210, 600, 1, ["Type: Portland Pozzolana Cement", "Best for: plastering and masonry", "Standard: IS 1489"]],
    ["Konark White Cement, 5 kg Pack", "Konark", 520, 430, "5 kg pack", 4.3, 2210, 90, 2, ["Type: White cement", "Use: wall putty, grouting and finishing", "Moisture-proof pack: yes"]],
    ["RapidSet Fast-Setting Cement, 25 kg", "RapidSet", 980, 820, "25 kg bag", 4.2, 640, 14, 2, ["Type: Rapid hardening", "Initial set: about 10 minutes", "Use: repairs and anchoring"]],
  ],
  Steel: [
    ["TMT Fe500D Bar 12 mm, 12 m Length", "Karnataka Steel Hub", 810, 724, "12 m bar", 4.7, 9320, 800, 2, ["Grade: Fe500D", "Weight: about 10.7 kg per bar", "Standard: IS 1786"]],
    ["TMT Fe550D Bar 16 mm, 12 m Length", "Sai Metals", 1490, 1342, "12 m bar", 4.5, 4120, 500, 2, ["Grade: Fe550D", "Weight: about 18.9 kg per bar", "Corrosion-resistant coating"]],
    ["Binding Wire 18 Gauge, 20 kg Coil", "Sai Metals", 1650, 1380, "20 kg coil", 4.3, 1870, 250, 1, ["Gauge: 18", "Annealed, soft and easy to tie", "Use: rebar tying"]],
    ["MS Angle 40×40×5 mm, 6 m Length", "Karnataka Steel Hub", 1980, 1760, "6 m length", 4.2, 760, 120, 3, ["Size: 40×40×5 mm", "Material: mild steel", "Use: frames, grills and supports"]],
  ],
  Sand: [
    ["Washed River Sand, 1 Tonne", "Cauvery Aggregates", 2200, 1850, "1 tonne", 4.2, 3150, 300, 2, ["Washed and screened", "Use: concrete and masonry", "Zone: II"]],
    ["M-Sand for Plastering, 1 Tonne", "Granite Works", 1900, 1650, "1 tonne", 4.5, 2940, 400, 2, ["Manufactured sand", "Use: plaster and block work", "Silt content: under 2%"]],
    ["20 mm Stone Aggregate, 1 Tonne", "Granite Works", 1650, 1450, "1 tonne", 4.4, 2210, 500, 2, ["Size: 20 mm", "Crushed angular stone", "Use: RCC and PCC"]],
    ["Fine Plastering Sand, 50 kg Bag", "Cauvery Aggregates", 160, 120, "50 kg bag", 4.1, 980, 900, 1, ["Bagged for easy carry", "Fine grade", "Use: finishing coats"]],
  ],
  Bricks: [
    ["Red Clay Bricks, Pack of 100", "Anekal Brick Works", 1100, 900, "pack of 100", 4.3, 5400, 200, 2, ["Size: 9×4×3 inch", "Compressive strength: 35 kg/cm²", "Colour: classic red"]],
    ["Fly Ash Bricks, Pack of 100", "GreenKiln", 880, 700, "pack of 100", 4.4, 4880, 350, 2, ["Size: 9×4×3 inch", "Eco-friendly, lower weight", "Water absorption: under 12%"]],
    ["Wirecut Bricks, Pack of 100", "Anekal Brick Works", 1500, 1250, "pack of 100", 4.5, 2310, 120, 3, ["Machine cut, uniform edges", "Use: exposed brickwork", "Strength: 75 kg/cm²"]],
    ["Perforated Bricks, Pack of 50", "GreenKiln", 950, 790, "pack of 50", 4.2, 640, 70, 3, ["Lightweight with cavities", "Good thermal insulation", "Use: partition walls"]],
  ],
  Blocks: [
    ["AAC Block 600×200×200 mm, Pack of 10", "Ecoblock India", 690, 580, "pack of 10", 4.6, 3760, 260, 2, ["Size: 600×200×200 mm", "Density: 600 kg/m³", "Fire resistant and lightweight"]],
    ["Solid Concrete Block 8 inch, Pack of 10", "Maruthi Blocks", 560, 460, "pack of 10", 4.1, 1420, 180, 2, ["Size: 400×200×200 mm", "Load bearing", "Use: boundary and structural walls"]],
    ["Hollow Concrete Block 6 inch, Pack of 10", "Maruthi Blocks", 470, 390, "pack of 10", 4.2, 1010, 150, 2, ["Size: 400×150×200 mm", "Hollow core for easy reinforcement", "Use: partition walls"]],
    ["Lightweight Cellular Block 4 inch, Pack of 20", "Ecoblock India", 1240, 1050, "pack of 20", 4.4, 520, 60, 3, ["Size: 600×100×200 mm", "Sound insulating", "Use: interior partitions"]],
  ],
  "Ready mix": [
    ["RMC M25 Concrete with Pump, 1 cu m", "RapidMix", 6600, 5900, "1 cu m", 4.5, 1210, 40, 3, ["Grade: M25", "Includes pump delivery", "Slump: 100 to 120 mm"]],
    ["RMC M30 Concrete, 1 cu m", "Nandi Ready Mix", 7000, 6350, "1 cu m", 4.4, 830, 30, 3, ["Grade: M30", "Transit mixer delivery", "Use: beams, slabs and columns"]],
    ["Dry Mortar Plaster Mix, 40 kg", "Nandi Ready Mix", 460, 380, "40 kg bag", 4.3, 1560, 500, 2, ["Ready to mix with water", "Consistent quality", "Coverage: about 10 sq ft at 12 mm"]],
    ["Non-Shrink Grout, 25 kg", "RapidMix", 1700, 1450, "25 kg bag", 4.4, 430, 90, 3, ["Flowable and non-shrink", "Use: base plates and anchor bolts", "Strength: 50 MPa at 28 days"]],
  ],
  Tiles: [
    ["Vitrified Floor Tile 600×600 mm, Box of 4", "Tilora", 1480, 1270, "box of 4", 4.4, 6120, 300, 3, ["Size: 600×600 mm", "Coverage: about 15.5 sq ft per box", "Finish: glossy"]],
    ["Anti-Skid Floor Tile 300×300 mm, Box of 11", "Orienta Tiles", 1090, 899, "box of 11", 4.2, 1980, 210, 3, ["Size: 300×300 mm", "Coverage: about 11.8 sq ft per box", "Use: bathrooms and balconies"]],
    ["Glossy Wall Tile 300×450 mm, Box of 6", "Tilora", 1190, 990, "box of 6", 4.3, 2230, 160, 3, ["Size: 300×450 mm", "Coverage: about 8.7 sq ft per box", "Use: kitchens and bathrooms"]],
    ["Tile Adhesive, 20 kg Bag", "Tilora", 640, 520, "20 kg bag", 4.4, 3340, 400, 1, ["Polymer modified", "Coverage: about 25 sq ft", "Use: floor and wall tiles"]],
  ],
  Plumbing: [
    ["CPVC Pipe 1 inch, 3 m Length", "Aqua Fittings", 210, 168, "3 m length", 4.3, 2760, 500, 1, ["Size: 1 inch", "Hot and cold water", "Standard: ASTM D2846"]],
    ["Water Storage Tank 1000 L", "Aquanova", 8400, 6900, "1000 L tank", 4.5, 2870, 50, 3, ["Capacity: 1000 litres", "Triple-layer, UV protected", "Warranty: 10 years"]],
    ["PVC Ball Valve 1/2 inch", "Aqua Fittings", 190, 145, "piece", 4.3, 3210, 600, 1, ["Size: 1/2 inch", "Quarter-turn handle", "Use: water lines"]],
    ["Wall Mixer with Overhead Shower, Chrome", "Aquanova", 4690, 3490, "set", 4.2, 1120, 40, 3, ["Finish: chrome", "Includes overhead shower", "Ceramic disc cartridge"]],
  ],
  Electrical: [
    ["FR Copper Wire 2.5 sq mm, 90 m Coil", "Voltline", 3100, 2450, "90 m coil", 4.6, 7210, 200, 2, ["Size: 2.5 sq mm", "Flame retardant, copper conductor", "Standard: IS 694"]],
    ["Modular Switch Plate, 6 Module", "Ancora", 260, 185, "piece", 4.3, 4890, 700, 1, ["Modules: 6", "Fire-retardant polycarbonate", "Colour: white"]],
    ["MCB 32 A Double Pole", "Voltline", 720, 520, "piece", 4.4, 2670, 320, 1, ["Rating: 32 A, double pole", "Breaking capacity: 10 kA", "DIN rail mounting"]],
    ["LED Batten 20 W, Pack of 2", "Lumos", 898, 598, "pack of 2", 4.1, 5120, 450, 1, ["Power: 20 W each", "Colour temperature: 6500 K", "Life: 25,000 hours"]],
  ],
  Paint: [
    ["Exterior Emulsion Paint, 20 L", "ColourCraft", 7400, 5800, "20 L bucket", 4.5, 4210, 120, 2, ["Finish: matt, weatherproof", "Coverage: about 120 sq ft per litre", "Warranty: 7 years"]],
    ["Interior Emulsion Paint, 10 L", "ColourCraft", 3900, 2980, "10 L bucket", 4.4, 3780, 160, 2, ["Finish: soft sheen", "Low odour, washable", "Coverage: about 110 sq ft per litre"]],
    ["Wall Putty, 40 kg", "WallMaster", 1550, 1250, "40 kg bag", 4.3, 6300, 500, 1, ["Type: white cement based", "Coverage: about 20 sq ft per kg", "Use: before primer"]],
    ["Wall Primer, 20 L", "WallMaster", 2700, 2150, "20 L bucket", 4.3, 2480, 140, 2, ["Type: water based", "Seals pores and improves adhesion", "Dry time: 4 hours"]],
  ],
  "Doors and windows": [
    ["Flush Door, Teak Finish 2100×900 mm", "TimberTrail", 11200, 8900, "piece", 4.2, 1640, 40, 4, ["Size: 2100×900 mm", "Core: solid block board", "Finish: teak veneer"]],
    ["UPVC Window 4×4 ft with Mesh", "WinCraft", 9400, 7400, "piece", 4.4, 1280, 35, 5, ["Size: 4×4 ft", "Sliding, with mosquito mesh", "Lead-free UPVC"]],
    ["Mortise Door Lock Set, Stainless Steel", "Securo", 2490, 1850, "set", 4.3, 3050, 180, 2, ["Material: stainless steel", "Includes 3 keys", "Finish: satin"]],
    ["Stainless Steel Door Handle, Pair", "Securo", 1190, 899, "pair", 4.2, 2210, 260, 2, ["Material: SS 304", "Length: 12 inch", "Finish: brushed"]],
  ],
  Safety: [
    ["Safety Helmet, ISI Marked", "SiteSafe", 420, 260, "piece", 4.4, 9870, 900, 1, ["Standard: IS 2925", "Adjustable ratchet", "Colour: yellow"]],
    ["Full Body Safety Harness", "SiteSafe", 2100, 1450, "piece", 4.5, 2640, 150, 2, ["Includes shock absorber lanyard", "Adjustable straps", "Rated for 140 kg"]],
    ["Steel Toe Safety Shoes", "SiteSafe", 1490, 899, "pair", 4.3, 5420, 300, 2, ["Steel toe cap", "Slip-resistant sole", "Sizes: 6 to 11"]],
    ["Hi-Vis Reflective Vest, Pack of 5", "SiteSafe", 650, 499, "pack of 5", 4.2, 3210, 600, 1, ["Reflective tape", "Free size with zip", "Colour: orange"]],
  ],
};

export const PRODUCTS: Product[] = [];
for (const [cat, rows] of Object.entries(RAW))
  rows.forEach((r) =>
    PRODUCTS.push({
      id: PRODUCTS.length,
      cat: cat as Category,
      name: r[0], brand: r[1], mrp: r[2], price: r[3], unit: r[4],
      rating: r[5], reviews: r[6], stock: r[7], days: r[8], specs: r[9],
      off: Math.round((1 - r[3] / r[2]) * 100),
      best: false,
    }),
  );
CATEGORIES.forEach((c) => {
  const l = PRODUCTS.filter((p) => p.cat === c).sort((a, b) => b.reviews - a.reviews);
  if (l[0]) l[0].best = true;
});

/* ---------- category placeholder art (verbatim from the prototype) ---------- */

const brickArt = (f: string, w = 30, h = 13) => {
  let s = '<clipPath id="bc"><rect x="12" y="10" width="96" height="60" rx="5"/></clipPath><g clip-path="url(#bc)">';
  for (let r = 0; r < 4; r++) for (let c = -1; c < 4; c++) s += `<rect x="${(r % 2 ? -15 : 0) + c * (w + 3) + 16}" y="${12 + r * (h + 2)}" width="${w}" height="${h}" rx="2" fill="${f}"/>`;
  return s + "</g>";
};

export const ART: Record<Category, string> = {
  Cement: '<ellipse cx="60" cy="72" rx="34" ry="4" fill="#0003"/><rect x="36" y="12" width="48" height="58" rx="6" fill="#8793A8"/><rect x="36" y="12" width="48" height="13" rx="6" fill="#6C7890"/><rect x="43" y="33" width="34" height="20" rx="3" fill="#FFC72C"/><text x="60" y="47" text-anchor="middle" font-family="Arial" font-size="12" font-weight="800" fill="#0B1F3A">OPC</text>',
  Steel: '<g stroke-linecap="round"><path d="M14 22h92M10 34h96M16 46h92M12 58h92" stroke="#51607A" stroke-width="7"/><path d="M14 22h92M10 34h96M16 46h92M12 58h92" stroke="#B3BFD3" stroke-width="2" stroke-dasharray="2 5"/></g>',
  Sand: '<path d="M6 68L46 26Q60 12 74 26L114 68z" fill="#E2B04A"/><path d="M60 14L114 68H72z" fill="#C98F2B"/><path d="M6 68h108" stroke="#0003"/>',
  Bricks: brickArt("#C2553A"),
  Blocks: '<rect x="16" y="14" width="42" height="26" rx="3" fill="#E3E8EF"/><rect x="62" y="14" width="42" height="26" rx="3" fill="#D2D9E3"/><rect x="38" y="44" width="42" height="26" rx="3" fill="#DDE3EC"/><g fill="#9AA6B8"><circle cx="28" cy="24" r="2"/><circle cx="44" cy="32" r="2"/><circle cx="74" cy="22" r="2"/><circle cx="92" cy="31" r="2"/><circle cx="52" cy="54" r="2"/><circle cx="68" cy="60" r="2"/></g>',
  "Ready mix": '<rect x="10" y="52" width="100" height="8" rx="2" fill="#34475F"/><path d="M12 50L17 22Q34 10 54 22L68 50z" fill="#C7D0DE"/><path d="M22 20l6 30M34 15l5 35M46 17l4 33" stroke="#8793A8" stroke-width="2"/><path d="M72 50V30h18l14 12v8z" fill="#FFC72C"/><rect x="80" y="34" width="10" height="9" fill="#13243D"/><g fill="#0B1F3A" stroke="#8793A8" stroke-width="2"><circle cx="28" cy="62" r="7"/><circle cx="56" cy="62" r="7"/><circle cx="94" cy="62" r="7"/></g>',
  Tiles: '<g><rect x="20" y="10" width="38" height="28" rx="3" fill="#2F8F96"/><rect x="62" y="10" width="38" height="28" rx="3" fill="#47A9AF"/><rect x="20" y="42" width="38" height="28" rx="3" fill="#47A9AF"/><rect x="62" y="42" width="38" height="28" rx="3" fill="#2F8F96"/><path d="M26 34L46 14M68 34l20-20M26 66l20-20M68 66l20-20" stroke="#fff" stroke-opacity=".35" stroke-width="3"/></g>',
  Plumbing: '<path d="M14 56H60Q78 56 78 38V16" fill="none" stroke="#2F6FD6" stroke-width="14"/><path d="M14 56H60Q78 56 78 38V16" fill="none" stroke="#8CB8FF" stroke-width="3"/><rect x="8" y="47" width="9" height="18" rx="2" fill="#1E4FA8"/><rect x="69" y="8" width="18" height="8" rx="2" fill="#1E4FA8"/>',
  Electrical: '<circle cx="56" cy="40" r="29" fill="none" stroke="#D8362B" stroke-width="8"/><circle cx="56" cy="40" r="19" fill="none" stroke="#EE6A5F" stroke-width="5"/><circle cx="56" cy="40" r="10" fill="#13243D"/><path d="M84 40h24" stroke="#D8362B" stroke-width="5" stroke-linecap="round"/><path d="M84 46h24" stroke="#FFC72C" stroke-width="5" stroke-linecap="round"/>',
  Paint: '<path d="M28 30L34 68H86L92 30z" fill="#7A47C8"/><ellipse cx="60" cy="30" rx="32" ry="7" fill="#B190EA"/><path d="M32 28Q60 -8 88 28" fill="none" stroke="#51607A" stroke-width="3"/><rect x="40" y="42" width="40" height="14" rx="2" fill="#FFC72C"/>',
  "Doors and windows": '<rect x="36" y="6" width="48" height="68" rx="3" fill="#8A5A2B"/><rect x="42" y="12" width="15" height="24" fill="#A87440"/><rect x="63" y="12" width="15" height="24" fill="#A87440"/><rect x="42" y="42" width="36" height="26" fill="#A87440"/><circle cx="77" cy="40" r="2.5" fill="#FFC72C"/>',
  Safety: '<path d="M22 54Q22 18 60 18Q98 18 98 54z" fill="#FFC72C"/><rect x="16" y="54" width="88" height="9" rx="4.5" fill="#E0A800"/><rect x="53" y="18" width="14" height="36" fill="#E0A800"/>',
};

/** Category tint used by `linear-gradient(160deg, var(--tint), mix(var(--h)))` placeholders. */
export const HUE: Record<Category, string> = {
  Cement: "#8793A8",
  Steel: "#51607A",
  Sand: "#E2B04A",
  Bricks: "#C2553A",
  Blocks: "#9AA6B8",
  "Ready mix": "#4B5563",
  Tiles: "#2F8F96",
  Plumbing: "#2F6FD6",
  Electrical: "#D8362B",
  Paint: "#7A47C8",
  "Doors and windows": "#8A5A2B",
  Safety: "#FFC72C",
};

/* ---------- mock seller offers (prototype synthesis; real sellers land with D11 backend) ---------- */

const POOL = ["Bharat Build Mart", "Metro Supplies", "Southern Traders", "Prime Materials", "Vijay Hardware", "KBR Distributors"];

export const sellersOf = (p: Product): SellerOffer[] => [
  { name: p.brand + " Official", price: p.price, days: p.days, verified: true, rating: p.rating },
  { name: POOL[p.id % 6], price: Math.round(p.price * 1.03), days: p.days, verified: true, rating: +(p.rating - 0.2).toFixed(1) },
  { name: POOL[(p.id + 3) % 6], price: Math.round(p.price * 0.97), days: p.days + 2, verified: false, rating: +(p.rating - 0.5).toFixed(1) },
];

export const PAIR: Record<Category, [Category, Category]> = {
  Cement: ["Sand", "Steel"],
  Steel: ["Cement", "Bricks"],
  Sand: ["Cement", "Bricks"],
  Bricks: ["Cement", "Sand"],
  Blocks: ["Cement", "Ready mix"],
  "Ready mix": ["Steel", "Sand"],
  Tiles: ["Paint", "Cement"],
  Plumbing: ["Electrical", "Paint"],
  Electrical: ["Plumbing", "Safety"],
  Paint: ["Tiles", "Doors and windows"],
  "Doors and windows": ["Paint", "Safety"],
  Safety: ["Steel", "Cement"],
};

/* ---------- hero slides (verbatim) ---------- */

export interface Slide {
  a: string;
  b: string;
  h: string;
  p: string;
  cta: string;
  cat?: Category;
  deal?: boolean;
  art: [string, string];
}

export const SLIDES: Slide[] = [
  { a: "#0B1F3A", b: "#1D4FBF", h: "Build bigger. Pay less.", p: "Up to 30% off cement, steel and sand. Free delivery to site on orders above ₹5,000.", cta: "Shop cement and steel", cat: "Cement", art: ["Cement", "Steel"] },
  { a: "#3B1B6B", b: "#7A47C8", h: "Fresh coat, fresh start.", p: "Emulsions, putty and primer from ColourCraft and WallMaster. Mix and save on every bucket.", cta: "Shop paint", cat: "Paint", art: ["Paint", "Tiles"] },
  { a: "#0E5A52", b: "#1AA39A", h: "Buy more, save more.", p: "Order 10+ units for 3% off, 50+ for 6% and 200+ for 10%. Applied automatically at checkout.", cta: "See today’s deals", deal: true, art: ["Bricks", "Blocks"] },
  { a: "#7A3A06", b: "#E8841A", h: "Safety first on every site.", p: "ISI helmets, harnesses and steel toe shoes, with next-day delivery in major cities.", cta: "Shop safety gear", cat: "Safety", art: ["Safety", "Electrical"] },
];
