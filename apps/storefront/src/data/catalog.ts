export interface ProductOption {
  name: string;
  displayAs: "PILL" | "SWATCH" | "DROPDOWN";
  values: {
    value: string;
    hexColor?: string;
  }[];
}

export interface ProductVariant {
  id: string;
  sku: string;
  title: string;
  price: number; // in INR
  mrp: number;   // in INR
  discountPercent: number;
  options: Record<string, string>; // e.g. { Capacity: "550 ml", Colour: "Pink" }
  inventory: number;
  imageUrl: string;
  weightGrams: number;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  category: "bottles" | "lunchboxes" | "casseroles" | "cookware";
  categoryName: string;
  material: string;
  thermalRetention?: string;
  usage: string;
  warrantyMonths: number;
  badges: string[];
  rating: number;
  reviewCount: number;
  personalizationAvailable: boolean;
  featuredImage: string;
  galleryImages: string[];
  options: ProductOption[];
  variants: ProductVariant[];
  descriptionHtml: string;
  specifications: {
    innerMaterial: string;
    outerMaterial: string;
    insulation: string;
    leakProof: boolean;
    dimensions: string;
    countryOfOrigin: string;
    careInstructions: string;
  };
}

export const CATEGORIES = [
  { id: "all", name: "All Products", count: 16 },
  { id: "bottles", name: "Bottles & Flasks", count: 12, icon: "🍼", popular: true },
  { id: "lunchboxes", name: "Lunchboxes & Tiffins", count: 2, icon: "🍱", popular: false },
  { id: "casseroles", name: "Casseroles & Hot Pots", count: 1, icon: "🍲", popular: false },
  { id: "cookware", name: "Cookware & Pans", count: 1, icon: "🍳", popular: false },
] as const;

export const COLOR_HEX: Record<string, string> = {
  Pink: "#e8a0b4",
  Ivory: "#f3ead3",
  Black: "#1b1b1b",
  "Olive Green": "#6b7a3a",
  Blue: "#2f6fb0",
  Silver: "#c4c8cc",
  Navy: "#1f3555",
  Red: "#c4301c",
  Teal: "#2a8c8c",
  Green: "#3b8f5b",
  Grey: "#8a8f94",
  Copper: "#b87333",
  Hammered: "#b87333",
  Plain: "#d49b29",
  Panda: "#f0f0f0",
  Rocket: "#d9533f",
  Unicorn: "#c9a0dc",
};

// Rich curated catalog with authentic Nestora-style homeware products
export const PRODUCTS: Product[] = [
  {
    id: "prod-aero-thermosteel",
    slug: "aero-thermosteel-bottle",
    title: "Aero Thermosteel Vacuum Bottle",
    tagline: "Double-walled vacuum insulated, rust-resistant SS 304 with silicone carry loop",
    category: "bottles",
    categoryName: "Vacuum Thermosteel",
    material: "SS 304 Food Grade Stainless Steel",
    thermalRetention: "24 Hours Hot & Cold",
    usage: "Office & Travel",
    warrantyMonths: 12,
    badges: ["Bestseller", "Save 18%", "ISI Certified"],
    rating: 4.8,
    reviewCount: 142,
    personalizationAvailable: true,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg",
    galleryImages: [
      "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg",
      "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg",
      "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Yellow_1_0b65d891-6bbb-4bd0-ac01-0c12141e5c47.jpg",
    ],
    options: [
      {
        name: "Capacity",
        displayAs: "PILL",
        values: [{ value: "550 ml" }, { value: "715 ml" }, { value: "880 ml" }],
      },
      {
        name: "Colour",
        displayAs: "SWATCH",
        values: [
          { value: "Pink", hexColor: "#e8a0b4" },
          { value: "Ivory", hexColor: "#f3ead3" },
          { value: "Black", hexColor: "#1b1b1b" },
          { value: "Olive Green", hexColor: "#6b7a3a" },
        ],
      },
    ],
    variants: [
      // 550 ml
      { id: "var-aero-550-pnk", sku: "AER-550-PNK", title: "550 ml / Pink", price: 802, mrp: 980, discountPercent: 18, options: { Capacity: "550 ml", Colour: "Pink" }, inventory: 24, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg", weightGrams: 390 },
      { id: "var-aero-550-ivr", sku: "AER-550-IVR", title: "550 ml / Ivory", price: 802, mrp: 980, discountPercent: 18, options: { Capacity: "550 ml", Colour: "Ivory" }, inventory: 18, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Yellow_1_0b65d891-6bbb-4bd0-ac01-0c12141e5c47.jpg", weightGrams: 390 },
      { id: "var-aero-550-blk", sku: "AER-550-BLK", title: "550 ml / Black", price: 802, mrp: 980, discountPercent: 18, options: { Capacity: "550 ml", Colour: "Black" }, inventory: 32, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg", weightGrams: 390 },
      { id: "var-aero-550-grn", sku: "AER-550-GRN", title: "550 ml / Olive Green", price: 802, mrp: 980, discountPercent: 18, options: { Capacity: "550 ml", Colour: "Olive Green" }, inventory: 15, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg", weightGrams: 390 },
      // 715 ml
      { id: "var-aero-715-pnk", sku: "AER-715-PNK", title: "715 ml / Pink", price: 893, mrp: 1090, discountPercent: 18, options: { Capacity: "715 ml", Colour: "Pink" }, inventory: 19, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg", weightGrams: 425 },
      { id: "var-aero-715-ivr", sku: "AER-715-IVR", title: "715 ml / Ivory", price: 893, mrp: 1090, discountPercent: 18, options: { Capacity: "715 ml", Colour: "Ivory" }, inventory: 12, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Yellow_1_0b65d891-6bbb-4bd0-ac01-0c12141e5c47.jpg", weightGrams: 425 },
      { id: "var-aero-715-blk", sku: "AER-715-BLK", title: "715 ml / Black", price: 893, mrp: 1090, discountPercent: 18, options: { Capacity: "715 ml", Colour: "Black" }, inventory: 22, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg", weightGrams: 425 },
      { id: "var-aero-715-grn", sku: "AER-715-GRN", title: "715 ml / Olive Green", price: 893, mrp: 1090, discountPercent: 18, options: { Capacity: "715 ml", Colour: "Olive Green" }, inventory: 14, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg", weightGrams: 425 },
      // 880 ml
      { id: "var-aero-880-pnk", sku: "AER-880-PNK", title: "880 ml / Pink", price: 998, mrp: 1220, discountPercent: 18, options: { Capacity: "880 ml", Colour: "Pink" }, inventory: 11, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg", weightGrams: 460 },
      { id: "var-aero-880-ivr", sku: "AER-880-IVR", title: "880 ml / Ivory", price: 998, mrp: 1220, discountPercent: 18, options: { Capacity: "880 ml", Colour: "Ivory" }, inventory: 0, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Yellow_1_0b65d891-6bbb-4bd0-ac01-0c12141e5c47.jpg", weightGrams: 460 },
      { id: "var-aero-880-blk", sku: "AER-880-BLK", title: "880 ml / Black", price: 998, mrp: 1220, discountPercent: 18, options: { Capacity: "880 ml", Colour: "Black" }, inventory: 20, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg", weightGrams: 460 },
      { id: "var-aero-880-grn", sku: "AER-880-GRN", title: "880 ml / Olive Green", price: 998, mrp: 1220, discountPercent: 18, options: { Capacity: "880 ml", Colour: "Olive Green" }, inventory: 8, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg", weightGrams: 460 },
    ],
    descriptionHtml: `<p>Aero is a premium double-walled vacuum insulated flask bottle with a subtle glitter finish and soft silicone loop for effortless carrying. Crafted with 304 food-grade stainless steel inside and out, with internal copper plating for peak temperature retention.</p>`,
    specifications: {
      innerMaterial: "SS 304 Food Grade Stainless Steel with Copper Coating",
      outerMaterial: "SS 304 High-Tensile Steel with Powder Finish",
      insulation: "Vacuum Double-Walled (24h Hot, 24h Cold)",
      leakProof: true,
      dimensions: "7.8 x 7.8 x 28.5 cm",
      countryOfOrigin: "India",
      careInstructions: "Wash with mild dish soap and warm water. Do not microwave or bleach.",
    },
  },
  {
    id: "prod-spark-flask",
    slug: "spark-vacuum-flask",
    title: "Spark Thermosteel Flask with Flip Lid",
    tagline: "Keeps tea and coffee piping hot for 24 hours with built-in drinking cup lid",
    category: "bottles",
    categoryName: "Vacuum Thermosteel",
    material: "SS 304 Food Grade Stainless Steel",
    thermalRetention: "24 Hours Hot & Cold",
    usage: "Travel & Trekking",
    warrantyMonths: 12,
    badges: ["Save 21%", "Hot & Cold"],
    rating: 4.7,
    reviewCount: 98,
    personalizationAvailable: true,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg",
    galleryImages: [
      "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg",
      "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/gps_generated_75516dca-c0e4-4db9-9915-7740d0bf5078.png",
    ],
    options: [
      {
        name: "Capacity",
        displayAs: "PILL",
        values: [{ value: "620 ml" }, { value: "920 ml" }],
      },
      {
        name: "Colour",
        displayAs: "SWATCH",
        values: [
          { value: "Black", hexColor: "#1b1b1b" },
          { value: "Blue", hexColor: "#2f6fb0" },
          { value: "Silver", hexColor: "#c4c8cc" },
          { value: "Red", hexColor: "#c4301c" },
        ],
      },
    ],
    variants: [
      { id: "var-spk-620-blk", sku: "SPK-620-BLK", title: "620 ml / Black", price: 749, mrp: 949, discountPercent: 21, options: { Capacity: "620 ml", Colour: "Black" }, inventory: 16, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg", weightGrams: 410 },
      { id: "var-spk-620-blu", sku: "SPK-620-BLU", title: "620 ml / Blue", price: 749, mrp: 949, discountPercent: 21, options: { Capacity: "620 ml", Colour: "Blue" }, inventory: 20, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/gps_generated_75516dca-c0e4-4db9-9915-7740d0bf5078.png", weightGrams: 410 },
      { id: "var-spk-620-slv", sku: "SPK-620-SLV", title: "620 ml / Silver", price: 749, mrp: 949, discountPercent: 21, options: { Capacity: "620 ml", Colour: "Silver" }, inventory: 25, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg", weightGrams: 410 },
      { id: "var-spk-620-red", sku: "SPK-620-RED", title: "620 ml / Red", price: 749, mrp: 949, discountPercent: 21, options: { Capacity: "620 ml", Colour: "Red" }, inventory: 14, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg", weightGrams: 410 },
      { id: "var-spk-920-blk", sku: "SPK-920-BLK", title: "920 ml / Black", price: 949, mrp: 1199, discountPercent: 21, options: { Capacity: "920 ml", Colour: "Black" }, inventory: 30, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg", weightGrams: 520 },
      { id: "var-spk-920-blu", sku: "SPK-920-BLU", title: "920 ml / Blue", price: 949, mrp: 1199, discountPercent: 21, options: { Capacity: "920 ml", Colour: "Blue" }, inventory: 18, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/gps_generated_75516dca-c0e4-4db9-9915-7740d0bf5078.png", weightGrams: 520 },
    ],
    descriptionHtml: `<p>Classic Nestora vacuum flask with thermal lock technology. Includes an insulated twist-and-pour stopper that doubles as a sturdy drinking cup.</p>`,
    specifications: {
      innerMaterial: "SS 304 Food Grade Stainless Steel",
      outerMaterial: "SS 304 Stainless Steel",
      insulation: "Vacuum Double Wall with Copper Shield",
      leakProof: true,
      dimensions: "8.2 x 8.2 x 31.0 cm",
      countryOfOrigin: "India",
      careInstructions: "Rinse with hot water before pouring tea or coffee for maximum thermal performance.",
    },
  },
  {
    id: "prod-royal-copper",
    slug: "royal-copper-bottle",
    title: "Royal Pure Ayurvedic Copper Bottle",
    tagline: "Hand-finished pure copper bottle delivering traditional Ayurvedic wellness benefits",
    category: "bottles",
    categoryName: "Copper Bottles",
    material: "99.9% Pure Copper",
    usage: "Daily Health & Home",
    warrantyMonths: 6,
    badges: ["100% Pure Copper", "Ayurvedic"],
    rating: 4.9,
    reviewCount: 84,
    personalizationAvailable: false,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Astronaut1024x1024_96ad65aa-b476-4693-9447-251f13bf0034.png",
    galleryImages: [
      "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Astronaut1024x1024_96ad65aa-b476-4693-9447-251f13bf0034.png",
    ],
    options: [
      {
        name: "Capacity",
        displayAs: "PILL",
        values: [{ value: "1 Litre" }],
      },
      {
        name: "Finish",
        displayAs: "PILL",
        values: [{ value: "Hammered" }, { value: "Plain Gloss" }],
      },
    ],
    variants: [
      { id: "var-rcb-1l-ham", sku: "RCB-100-HAM", title: "1 Litre / Hammered", price: 1299, mrp: 1599, discountPercent: 19, options: { Capacity: "1 Litre", Finish: "Hammered" }, inventory: 40, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Astronaut1024x1024_96ad65aa-b476-4693-9447-251f13bf0034.png", weightGrams: 420 },
      { id: "var-rcb-1l-pln", sku: "RCB-100-PLN", title: "1 Litre / Plain Gloss", price: 1099, mrp: 1399, discountPercent: 21, options: { Capacity: "1 Litre", Finish: "Plain Gloss" }, inventory: 28, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Astronaut1024x1024_96ad65aa-b476-4693-9447-251f13bf0034.png", weightGrams: 410 },
    ],
    descriptionHtml: `<p>Infuse drinking water with natural copper ions overnight (Tamra Jal). Made from 99.9% pure certified copper with leak-proof silicone seal thread.</p>`,
    specifications: {
      innerMaterial: "Uncoated 99.9% Pure Copper",
      outerMaterial: "Lacquered Copper for tarnish resistance",
      insulation: "Single Wall Natural Cooling",
      leakProof: true,
      dimensions: "7.5 x 7.5 x 27.0 cm",
      countryOfOrigin: "India",
      careInstructions: "Clean internal surface with lemon and salt or Pitambari powder once weekly. Do not refrigerate.",
    },
  },
  {
    id: "prod-aqua-sipper",
    slug: "aqua-sports-sipper",
    title: "Aqua Active Sports Gym Sipper",
    tagline: "BPA-Free lightweight ergonomic hydration bottle with fast-flow pop straw",
    category: "bottles",
    categoryName: "Sports & Sippers",
    material: "100% Food Grade BPA-Free Tritan",
    usage: "Gym & Fitness",
    warrantyMonths: 3,
    badges: ["New", "BPA Free"],
    rating: 4.6,
    reviewCount: 65,
    personalizationAvailable: false,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Del.jpg",
    galleryImages: ["https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Del.jpg"],
    options: [
      {
        name: "Capacity",
        displayAs: "PILL",
        values: [{ value: "750 ml" }],
      },
      {
        name: "Lid Type",
        displayAs: "PILL",
        values: [{ value: "Pop Straw" }, { value: "Chug Sipper" }],
      },
      {
        name: "Colour",
        displayAs: "SWATCH",
        values: [
          { value: "Blue", hexColor: "#2f6fb0" },
          { value: "Black", hexColor: "#1b1b1b" },
          { value: "Green", hexColor: "#3b8f5b" },
        ],
      },
    ],
    variants: [
      { id: "var-aqs-str-blu", sku: "AQS-STR-BLU", title: "750 ml / Pop Straw / Blue", price: 349, mrp: 449, discountPercent: 22, options: { Capacity: "750 ml", "Lid Type": "Pop Straw", Colour: "Blue" }, inventory: 35, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Del.jpg", weightGrams: 160 },
      { id: "var-aqs-str-blk", sku: "AQS-STR-BLK", title: "750 ml / Pop Straw / Black", price: 349, mrp: 449, discountPercent: 22, options: { Capacity: "750 ml", "Lid Type": "Pop Straw", Colour: "Black" }, inventory: 40, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Del.jpg", weightGrams: 160 },
      { id: "var-aqs-chg-grn", sku: "AQS-CHG-GRN", title: "750 ml / Chug Sipper / Green", price: 319, mrp: 419, discountPercent: 24, options: { Capacity: "750 ml", "Lid Type": "Chug Sipper", Colour: "Green" }, inventory: 25, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Del.jpg", weightGrams: 155 },
    ],
    descriptionHtml: `<p>Designed for active lifestyles. One-touch flip lid allows instant one-handed drinking while cycling or exercising. Measurement markings help track daily water intake.</p>`,
    specifications: {
      innerMaterial: "Shatterproof Tritan Coplymer (BPA-Free)",
      outerMaterial: "Soft-Touch Matte Texture",
      insulation: "Single Wall Lightweight",
      leakProof: true,
      dimensions: "7.2 x 7.2 x 25.0 cm",
      countryOfOrigin: "India",
      careInstructions: "Top-rack dishwasher safe.",
    },
  },
  {
    id: "prod-buddy-kids",
    slug: "buddy-kids-flask",
    title: "Buddy Kids Insulated Sipper Flask",
    tagline: "Compact 500ml stainless steel flask with hygienic bite valve and carry strap",
    category: "bottles",
    categoryName: "Kids Bottles",
    material: "SS 304 Food Grade Stainless Steel",
    thermalRetention: "12 Hours Hot & Cold",
    usage: "School & Kids",
    warrantyMonths: 12,
    badges: ["Kids Favorite", "Leakproof"],
    rating: 4.9,
    reviewCount: 110,
    personalizationAvailable: true,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Sanket.gif",
    galleryImages: ["https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Sanket.gif"],
    options: [
      {
        name: "Capacity",
        displayAs: "PILL",
        values: [{ value: "500 ml" }],
      },
      {
        name: "Character",
        displayAs: "SWATCH",
        values: [
          { value: "Panda", hexColor: "#f0f0f0" },
          { value: "Rocket", hexColor: "#d9533f" },
          { value: "Unicorn", hexColor: "#c9a0dc" },
        ],
      },
    ],
    variants: [
      { id: "var-bdy-pnd", sku: "BDY-500-PND", title: "500 ml / Panda", price: 529, mrp: 699, discountPercent: 24, options: { Capacity: "500 ml", Character: "Panda" }, inventory: 22, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Sanket.gif", weightGrams: 280 },
      { id: "var-bdy-rkt", sku: "BDY-500-RKT", title: "500 ml / Rocket", price: 529, mrp: 699, discountPercent: 24, options: { Capacity: "500 ml", Character: "Rocket" }, inventory: 19, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Sanket.gif", weightGrams: 280 },
      { id: "var-bdy-unc", sku: "BDY-500-UNC", title: "500 ml / Unicorn", price: 529, mrp: 699, discountPercent: 24, options: { Capacity: "500 ml", Character: "Unicorn" }, inventory: 15, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Sanket.gif", weightGrams: 280 },
    ],
    descriptionHtml: `<p>Keep kids hydrated at school. Double-wall thermal insulation keeps milk, juice, or water cold or warm all day. Push-button lid with secure locking latch prevents accidental openings.</p>`,
    specifications: {
      innerMaterial: "SS 304 Antibacterial Steel",
      outerMaterial: "Scratch-Resistant Enamel Coating",
      insulation: "Vacuum Double-Walled (12h Cold / 12h Warm)",
      leakProof: true,
      dimensions: "6.8 x 6.8 x 21.5 cm",
      countryOfOrigin: "India",
      careInstructions: "Disassemble silicone spout to wash thoroughly.",
    },
  },
  {
    id: "prod-clear-glass",
    slug: "clear-glass-infuser",
    title: "PureGlass Fruit & Herb Infuser Bottle",
    tagline: "High-grade borosilicate glass bottle with removable stainless steel infuser basket",
    category: "bottles",
    categoryName: "Glass Bottles",
    material: "Borosilicate Glass + SS 304 Basket",
    usage: "Office & Detox",
    warrantyMonths: 6,
    badges: ["Eco Friendly", "Detox"],
    rating: 4.7,
    reviewCount: 52,
    personalizationAvailable: false,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg",
    galleryImages: ["https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg"],
    options: [
      {
        name: "Capacity",
        displayAs: "PILL",
        values: [{ value: "500 ml" }, { value: "750 ml" }],
      },
      {
        name: "Sleeve Colour",
        displayAs: "SWATCH",
        values: [
          { value: "Grey", hexColor: "#8a8f94" },
          { value: "Teal", hexColor: "#2a8c8c" },
        ],
      },
    ],
    variants: [
      { id: "var-cgi-500-gry", sku: "CGI-500-GRY", title: "500 ml / Grey", price: 399, mrp: 529, discountPercent: 25, options: { Capacity: "500 ml", "Sleeve Colour": "Grey" }, inventory: 18, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg", weightGrams: 340 },
      { id: "var-cgi-750-tel", sku: "CGI-750-TEL", title: "750 ml / Teal", price: 479, mrp: 629, discountPercent: 24, options: { Capacity: "750 ml", "Sleeve Colour": "Teal" }, inventory: 14, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg", weightGrams: 420 },
    ],
    descriptionHtml: `<p>Enjoy refreshing detox water infused with lemon, mint, or green tea. Heat-resistant borosilicate glass resists thermal shock up to 150°C and includes a non-slip silicone protective sleeve.</p>`,
    specifications: {
      innerMaterial: "High Borosilicate Lead-Free Glass",
      outerMaterial: "Protective Food Grade Silicone Sleeve",
      insulation: "Single Wall Thermal Shock Resistant",
      leakProof: true,
      dimensions: "7.0 x 7.0 x 24.5 cm",
      countryOfOrigin: "India",
      careInstructions: "Dishwasher safe. Handle glass with normal care.",
    },
  },
  {
    id: "prod-everyday-steel",
    slug: "everyday-steel-bottle",
    title: "Classic Single-Wall Stainless Steel Bottle",
    tagline: "Ultra-durable, rust-free fridge bottle designed for everyday family hydration",
    category: "bottles",
    categoryName: "Stainless Steel",
    material: "Grade 304 Stainless Steel",
    usage: "Home & Fridge",
    warrantyMonths: 12,
    badges: ["Fridge Friendly", "Great Value"],
    rating: 4.8,
    reviewCount: 230,
    personalizationAvailable: true,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg",
    galleryImages: ["https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg"],
    options: [
      {
        name: "Capacity",
        displayAs: "PILL",
        values: [{ value: "750 ml" }, { value: "1 Litre" }],
      },
      {
        name: "Colour",
        displayAs: "SWATCH",
        values: [
          { value: "Silver", hexColor: "#c4c8cc" },
          { value: "Black", hexColor: "#1b1b1b" },
        ],
      },
    ],
    variants: [
      { id: "var-eds-750-slv", sku: "EDS-750-SLV", title: "750 ml / Silver", price: 299, mrp: 399, discountPercent: 25, options: { Capacity: "750 ml", Colour: "Silver" }, inventory: 50, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg", weightGrams: 220 },
      { id: "var-eds-100-blk", sku: "EDS-100-BLK", title: "1 Litre / Black", price: 379, mrp: 499, discountPercent: 24, options: { Capacity: "1 Litre", Colour: "Black" }, inventory: 45, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/613BVLHhcHL._SL1500.jpg", weightGrams: 260 },
    ],
    descriptionHtml: `<p>Lightweight single-wall stainless steel bottle that fits neatly into standard refrigerator door shelves. Wide mouth accommodates standard ice cubes easily.</p>`,
    specifications: {
      innerMaterial: "SS 304 High-Grade Steel",
      outerMaterial: "Mirror Polish Finish",
      insulation: "Single Wall Fridge Bottle",
      leakProof: true,
      dimensions: "7.4 x 7.4 x 26.5 cm",
      countryOfOrigin: "India",
      careInstructions: "Wash with bottle brush and mild soap.",
    },
  },
  {
    id: "prod-trek-jug",
    slug: "trek-insulated-jug",
    title: "Trek Expedition Insulated Thermal Jug",
    tagline: "Large 1.2L capacity rugged thermal flask with ergonomic carry handle",
    category: "bottles",
    categoryName: "Vacuum Thermosteel",
    material: "SS 304 Stainless Steel",
    thermalRetention: "24 Hours Hot & Cold",
    usage: "Travel & Roadtrips",
    warrantyMonths: 12,
    badges: ["Heavy Duty", "24h Cold"],
    rating: 4.9,
    reviewCount: 78,
    personalizationAvailable: true,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg",
    galleryImages: ["https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg"],
    options: [
      {
        name: "Capacity",
        displayAs: "PILL",
        values: [{ value: "1.2 Litre" }],
      },
      {
        name: "Colour",
        displayAs: "SWATCH",
        values: [
          { value: "Olive Green", hexColor: "#6b7a3a" },
          { value: "Black", hexColor: "#1b1b1b" },
          { value: "Navy", hexColor: "#1f3555" },
        ],
      },
    ],
    variants: [
      { id: "var-trk-12-grn", sku: "TRK-120-GRN", title: "1.2 Litre / Olive Green", price: 1499, mrp: 1899, discountPercent: 21, options: { Capacity: "1.2 Litre", Colour: "Olive Green" }, inventory: 24, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg", weightGrams: 640 },
      { id: "var-trk-12-blk", sku: "TRK-120-BLK", title: "1.2 Litre / Black", price: 1499, mrp: 1899, discountPercent: 21, options: { Capacity: "1.2 Litre", Colour: "Black" }, inventory: 30, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Black_1_d3d95461-640a-45c9-9f97-07832aac6ba0.jpg", weightGrams: 640 },
    ],
    descriptionHtml: `<p>Built for long road journeys, weekend camping, and outdoor adventures. Heavy-gauge stainless steel construction with reinforced rubber base bumpers.</p>`,
    specifications: {
      innerMaterial: "SS 304 Copper Shield Vacuum",
      outerMaterial: "Powder Coated Textured Finish",
      insulation: "Dual Chamber Vacuum (24h Temperature Retention)",
      leakProof: true,
      dimensions: "9.5 x 9.5 x 32.0 cm",
      countryOfOrigin: "India",
      careInstructions: "Hand wash only. Not suitable for carbonated beverages.",
    },
  },
  // Scalable Categories showcase (Lunchboxes, Casseroles, Cookware)
  {
    id: "prod-fut-tiffin",
    slug: "executive-insulated-tiffin",
    title: "Executive Insulated 3-Container Steel Lunchbox",
    tagline: "Leak-proof stainless steel tiffin set with high-density thermal insulated jacket",
    category: "lunchboxes",
    categoryName: "Lunchboxes & Tiffins",
    material: "SS 304 Steel + Thermal Fabric Bag",
    usage: "Office & Commute",
    warrantyMonths: 12,
    badges: ["Scalable Category", "Coming Soon"],
    rating: 4.8,
    reviewCount: 34,
    personalizationAvailable: false,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Yellow_1_0b65d891-6bbb-4bd0-ac01-0c12141e5c47.jpg",
    galleryImages: ["https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Yellow_1_0b65d891-6bbb-4bd0-ac01-0c12141e5c47.jpg"],
    options: [
      {
        name: "Containers",
        displayAs: "PILL",
        values: [{ value: "3 Containers (300ml each)" }, { value: "4 Containers" }],
      },
      {
        name: "Jacket Colour",
        displayAs: "SWATCH",
        values: [
          { value: "Navy", hexColor: "#1f3555" },
          { value: "Grey", hexColor: "#8a8f94" },
        ],
      },
    ],
    variants: [
      { id: "var-tif-3c-nvy", sku: "TIF-3C-NVY", title: "3 Containers / Navy", price: 899, mrp: 1199, discountPercent: 25, options: { Containers: "3 Containers (300ml each)", "Jacket Colour": "Navy" }, inventory: 20, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Yellow_1_0b65d891-6bbb-4bd0-ac01-0c12141e5c47.jpg", weightGrams: 580 },
    ],
    descriptionHtml: `<p>Future category expansion: Demonstrates how the exact same multi-variant system handles Container Count and Jacket Type seamlessly.</p>`,
    specifications: {
      innerMaterial: "SS 304 Food Grade Containers with Silicone Lids",
      outerMaterial: "Machine Washable Insulated Fabric",
      insulation: "Thermal Foam Layer keeps food warm for 4-5 hours",
      leakProof: true,
      dimensions: "15 x 15 x 22 cm",
      countryOfOrigin: "India",
      careInstructions: "Wipe jacket with damp cloth. Steel containers dishwasher safe.",
    },
  },
  {
    id: "prod-fut-casserole",
    slug: "royal-hot-pot-casserole-set",
    title: "Royal Double-Walled Thermal Casserole Set of 3",
    tagline: "Insulated hot pot casseroles with locking lids (1000ml, 1500ml, 2500ml)",
    category: "casseroles",
    categoryName: "Casseroles & Hot Pots",
    material: "SS 304 Inner + Virgin Food Grade Outer",
    thermalRetention: "6 Hours Warm Serving",
    usage: "Dining & Hosting",
    warrantyMonths: 12,
    badges: ["Scalable Category", "Festival Gift"],
    rating: 4.9,
    reviewCount: 47,
    personalizationAvailable: false,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg",
    galleryImages: ["https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg"],
    options: [
      {
        name: "Set Size",
        displayAs: "PILL",
        values: [{ value: "Set of 3 (1L, 1.5L, 2.5L)" }],
      },
      {
        name: "Finish",
        displayAs: "SWATCH",
        values: [
          { value: "Ivory", hexColor: "#f3ead3" },
          { value: "Pink", hexColor: "#e8a0b4" },
        ],
      },
    ],
    variants: [
      { id: "var-cas-3s-ivr", sku: "CAS-3S-IVR", title: "Set of 3 / Ivory", price: 1699, mrp: 2199, discountPercent: 23, options: { "Set Size": "Set of 3 (1L, 1.5L, 2.5L)", Finish: "Ivory" }, inventory: 15, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Felice_Pink_1_115ca606-cc98-4a82-b483-a86d63337761.jpg", weightGrams: 1400 },
    ],
    descriptionHtml: `<p>Future category expansion: Keeps chapattis, biryani, and curries hot and fresh for buffet meals and family gatherings.</p>`,
    specifications: {
      innerMaterial: "Heavy-Gauge SS 304 Stainless Steel",
      outerMaterial: "BPA-Free Polypropylene with Gold Accent Trims",
      insulation: "Polyurethane Foam (PUF) insulation",
      leakProof: true,
      dimensions: "Multiple sizes in nesting box",
      countryOfOrigin: "India",
      careInstructions: "Do not place on direct flame or in microwave.",
    },
  },
  {
    id: "prod-fut-cookware",
    slug: "triply-stainless-steel-kadhai",
    title: "Triply Heavy Base Stainless Steel Kadhai",
    tagline: "3-Layer construction (SS 304 + Aluminium Core + SS 430) for even induction cooking",
    category: "cookware",
    categoryName: "Cookware & Pans",
    material: "Triply Stainless Steel",
    usage: "Kitchen & Induction",
    warrantyMonths: 60,
    badges: ["5 Year Warranty", "Induction Ready"],
    rating: 4.9,
    reviewCount: 89,
    personalizationAvailable: false,
    featuredImage: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Astronaut1024x1024_96ad65aa-b476-4693-9447-251f13bf0034.png",
    galleryImages: ["https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Astronaut1024x1024_96ad65aa-b476-4693-9447-251f13bf0034.png"],
    options: [
      {
        name: "Diameter",
        displayAs: "PILL",
        values: [{ value: "24 cm (2.5L)" }, { value: "28 cm (4.0L)" }],
      },
      {
        name: "Lid",
        displayAs: "PILL",
        values: [{ value: "Tempered Glass Lid" }, { value: "Stainless Steel Lid" }],
      },
    ],
    variants: [
      { id: "var-kdh-24-gls", sku: "KDH-24-GLS", title: "24 cm (2.5L) / Tempered Glass Lid", price: 1899, mrp: 2499, discountPercent: 24, options: { Diameter: "24 cm (2.5L)", Lid: "Tempered Glass Lid" }, inventory: 25, imageUrl: "https://cdn.shopify.com/s/files/1/0612/0964/1060/files/Astronaut1024x1024_96ad65aa-b476-4693-9447-251f13bf0034.png", weightGrams: 1250 },
    ],
    descriptionHtml: `<p>Future category expansion: Triply technology prevents hot spots and food burning while saving up to 20% cooking fuel or electricity.</p>`,
    specifications: {
      innerMaterial: "Food Grade 304 Stainless Steel (Toxin-free)",
      outerMaterial: "Magnetic SS 430 compatible with all induction cooktops",
      insulation: "Encapsulated Pure Aluminium Core",
      leakProof: false,
      dimensions: "24 x 24 x 9.5 cm",
      countryOfOrigin: "India",
      careInstructions: "Dishwasher safe. Safe with metal spatulas.",
    },
  },
];
