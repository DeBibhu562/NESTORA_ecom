import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/index";

const API = process.env.PUBLIC_API_URL ?? "http://localhost:4010";
const DIR = fileURLToPath(new URL("../../../apps/api/uploads/seed", import.meta.url));

const HEX: Record<string, string> = {
  Pink: "#e8a0b4", Ivory: "#f3ead3", Black: "#1b1b1b", "Olive Green": "#6b7a3a", Blue: "#2f6fb0", Green: "#3b8f5b", Grey: "#8a8f94",
  Teal: "#2a8c8c", Silver: "#c4c8cc", Copper: "#b87333", Panda: "#e5e5e5", Rocket: "#d9533f", Unicorn: "#c9a0dc", Navy: "#1f3555", Red: "#c4301c",
};

// Placeholder bottle art so the UI has something to render until real photography exists.
function svg(color: string, label: string) {
  const c = HEX[color] ?? "#8a8f94";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="#f7f7f5"/>` +
    `<rect x="255" y="70" width="90" height="50" rx="10" fill="#072835"/><rect x="240" y="115" width="120" height="30" rx="8" fill="#56696f"/>` +
    `<rect x="215" y="140" width="170" height="410" rx="45" fill="${c}"/><rect x="235" y="190" width="14" height="300" rx="7" fill="#fff" opacity=".35"/>` +
    `<text x="300" y="380" font-family="Georgia,serif" font-size="30" text-anchor="middle" fill="#fff" opacity=".9">${label}</text></svg>`;
}

type Spec = {
  slug: string; title: string; tagline: string; cat: string; prefix: string; hsn?: string; material: string; thermal?: string; usage: string;
  warranty: number; options: { name: string; display?: "PILL" | "SWATCH"; values: string[] }[];
  price: (v: Record<string, string>) => [number, number]; // [price, mrp] in paise
  weight: (v: Record<string, string>) => number;
  imageOption: string; badges?: string[]; soldOut?: string[]; // combos "a/b" with zero stock
};

const ml = (s: string) => (s.includes("L") && !s.includes("ml") ? parseFloat(s) * 1000 : parseInt(s));
const bySize = (o: Record<number, [number, number]>) => (v: Record<string, string>) => o[ml(v.Capacity!)] ?? [49900, 59900];

const SPECS: Spec[] = [
  { slug: "aero-thermosteel-bottle", title: "Aero Thermosteel Bottle", tagline: "Vacuum insulated, rust-resistant & leakproof", cat: "vacuum", prefix: "AER", material: "SS 304", thermal: "24h hot & cold", usage: "Office", warranty: 12, badges: ["Bestseller"],
    options: [{ name: "Capacity", values: ["550 ml", "715 ml", "880 ml"] }, { name: "Colour", display: "SWATCH", values: ["Pink", "Ivory", "Black", "Olive Green"] }],
    price: bySize({ 550: [80200, 98000], 715: [89300, 109000], 880: [99800, 122000] }), weight: (v) => 280 + ml(v.Capacity!) / 5, imageOption: "Colour", soldOut: ["880 ml/Ivory"] },
  { slug: "spark-vacuum-flask", title: "Spark Vacuum Flask", tagline: "Keeps tea hot for 24 hours", cat: "vacuum", prefix: "SPK", material: "SS 304", thermal: "24h hot & cold", usage: "Travel", warranty: 12,
    options: [{ name: "Capacity", values: ["620 ml", "920 ml"] }, { name: "Colour", display: "SWATCH", values: ["Black", "Silver", "Navy", "Red"] }],
    price: bySize({ 620: [74900, 94900], 920: [94900, 119900] }), weight: (v) => 300 + ml(v.Capacity!) / 4, imageOption: "Colour" },
  { slug: "royal-copper-bottle", title: "Royal Copper Bottle", tagline: "Hand-finished copper for daily water", cat: "copper", prefix: "RCB", material: "Copper", usage: "Office", warranty: 6,
    options: [{ name: "Capacity", values: ["1 L"] }, { name: "Finish", values: ["Hammered", "Plain"] }],
    price: (v) => (v.Finish === "Hammered" ? [129900, 159900] : [109900, 139900]), weight: () => 420, imageOption: "Finish" },
  { slug: "aqua-sports-sipper", title: "Aqua Sports Sipper", tagline: "BPA-free, one-hand sipper for the gym", cat: "sports", prefix: "AQS", material: "BPA-free plastic", usage: "Gym & sports", warranty: 3, badges: ["New"],
    options: [{ name: "Capacity", values: ["750 ml"] }, { name: "Lid", values: ["Straw", "Sipper"] }, { name: "Colour", display: "SWATCH", values: ["Blue", "Black", "Green"] }],
    price: (v) => (v.Lid === "Straw" ? [34900, 44900] : [31900, 41900]), weight: () => 160, imageOption: "Colour" },
  { slug: "buddy-kids-flask", title: "Buddy Kids Flask", tagline: "Spill-proof flask with a soft-grip sipper", cat: "kids", prefix: "BDY", material: "SS 304", thermal: "12h hot", usage: "School & kids", warranty: 12, badges: ["Kids"],
    options: [{ name: "Capacity", values: ["500 ml"] }, { name: "Character", display: "SWATCH", values: ["Panda", "Rocket", "Unicorn"] }],
    price: () => [52900, 69900], weight: () => 250, imageOption: "Character" },
  { slug: "clear-glass-infuser", title: "Clear Glass Infuser Bottle", tagline: "Borosilicate glass with a fruit infuser", cat: "glass", prefix: "CGI", material: "Glass", usage: "Office", warranty: 3,
    options: [{ name: "Capacity", values: ["500 ml", "750 ml"] }, { name: "Sleeve", display: "SWATCH", values: ["Grey", "Teal"] }],
    price: bySize({ 500: [39900, 52900], 750: [47900, 62900] }), weight: (v) => 220 + ml(v.Capacity!) / 3, imageOption: "Sleeve" },
  { slug: "everyday-steel-bottle", title: "Everyday Steel Bottle", tagline: "Single-wall stainless steel, built to last", cat: "single-wall", prefix: "EDS", material: "Single-wall steel", usage: "Office", warranty: 12,
    options: [{ name: "Capacity", values: ["750 ml", "1 L"] }, { name: "Colour", display: "SWATCH", values: ["Silver", "Black"] }],
    price: bySize({ 750: [29900, 39900], 1000: [37900, 49900] }), weight: (v) => 150 + ml(v.Capacity!) / 10, imageOption: "Colour" },
  { slug: "trek-insulated-jug", title: "Trek Insulated Jug", tagline: "1.2 L insulated jug for the trail", cat: "vacuum", prefix: "TRK", material: "SS 304", thermal: "24h hot & cold", usage: "Travel", warranty: 12,
    options: [{ name: "Capacity", values: ["1.2 L"] }, { name: "Colour", display: "SWATCH", values: ["Olive Green", "Black", "Navy"] }],
    price: () => [149900, 189900], weight: () => 640, imageOption: "Colour" },
  { slug: "desk-slim-bottle", title: "Desk Slim Bottle", tagline: "Slim 500 ml that fits any cup holder", cat: "vacuum", prefix: "DSK", material: "SS 304", thermal: "12h hot", usage: "Office", warranty: 12,
    options: [{ name: "Capacity", values: ["500 ml"] }, { name: "Colour", display: "SWATCH", values: ["Ivory", "Pink", "Teal", "Black"] }],
    price: () => [59900, 79900], weight: () => 240, imageOption: "Colour" },
  { slug: "pro-gym-shaker", title: "Pro Gym Shaker", tagline: "Leak-proof shaker with mixing ball", cat: "sports", prefix: "PGS", material: "BPA-free plastic", usage: "Gym & sports", warranty: 3,
    options: [{ name: "Capacity", values: ["700 ml"] }, { name: "Colour", display: "SWATCH", values: ["Black", "Red", "Blue"] }],
    price: () => [24900, 34900], weight: () => 140, imageOption: "Colour" },
  { slug: "junior-sipper-bottle", title: "Junior Sipper Bottle", tagline: "Lightweight sipper for school bags", cat: "kids", prefix: "JNR", material: "BPA-free plastic", usage: "School & kids", warranty: 3,
    options: [{ name: "Capacity", values: ["400 ml", "600 ml"] }, { name: "Character", display: "SWATCH", values: ["Panda", "Rocket"] }],
    price: bySize({ 400: [19900, 27900], 600: [24900, 32900] }), weight: (v) => 100 + ml(v.Capacity!) / 8, imageOption: "Character" },
  { slug: "heritage-copper-jug", title: "Heritage Copper Jug", tagline: "Serve-and-store copper jug, 1.5 L", cat: "copper", prefix: "HCJ", material: "Copper", usage: "Office", warranty: 6,
    options: [{ name: "Capacity", values: ["1.5 L"] }, { name: "Finish", values: ["Hammered", "Plain"] }],
    price: (v) => (v.Finish === "Hammered" ? [189900, 239900] : [169900, 219900]), weight: () => 780, imageOption: "Finish" },
];

const combos = (opts: Spec["options"]): Record<string, string>[] =>
  opts.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.name]: v }))), [{}]);

const abbr = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);

export async function seedCatalog() {
  mkdirSync(DIR, { recursive: true });
  const wh = await prisma.warehouse.findUniqueOrThrow({ where: { code: "MAIN" } });
  let made = 0;

  for (const s of SPECS) {
    if (await prisma.product.findUnique({ where: { slug: s.slug } })) continue;
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: s.cat } });
    const product = await prisma.product.create({
      data: {
        slug: s.slug, title: s.title, tagline: s.tagline, status: "ACTIVE", categoryId: category.id, hsnCode: "7323", gstRateBp: 1800, badges: s.badges ?? [], warrantyMonths: s.warranty,
        descriptionHtml: `<p>${s.tagline}. Made from ${s.material}. Designed for everyday use.</p>`,
        attributes: { material: s.material, ...(s.thermal ? { thermal_retention: s.thermal } : {}), usage: s.usage, leak_proof: true, country_of_origin: "India", manufacturer: "Example Housewares Pvt Ltd" },
        personalizationEnabled: s.material === "SS 304", personalizationPricePaise: s.material === "SS 304" ? 9900 : null,
        options: { create: s.options.map((o, i) => ({ name: o.name, displayAs: o.display ?? "PILL", position: i, values: { create: o.values.map((v, j) => ({ value: v, position: j, hexColor: o.display === "SWATCH" ? HEX[v] : undefined })) } })) },
      },
      include: { options: { include: { values: true } } },
    });
    const ov = (name: string, value: string) => product.options.find((o) => o.name === name)!.values.find((v) => v.value === value)!;

    // one image per value of the image-driving option (colour etc.), plus a generic first image
    for (const [i, value] of s.options.find((o) => o.name === s.imageOption)!.values.entries()) {
      const file = `${s.slug}-${abbr(value).toLowerCase()}.svg`;
      writeFileSync(resolve(DIR, file), svg(value, s.title.split(" ")[0]!));
      await prisma.productMedia.create({ data: { productId: product.id, optionValueId: ov(s.imageOption, value).id, url: `${API}/uploads/seed/${file}`, alt: `${s.title} in ${value}`, width: 600, height: 600, position: i } });
    }

    for (const [n, c] of combos(s.options).entries()) {
      const [price, mrp] = s.price(c);
      const key = s.options.map((o) => c[o.name]).join("/");
      const v = await prisma.variant.create({
        data: { productId: product.id, sku: [s.prefix, ...s.options.map((o) => abbr(c[o.name]!))].join("-"), pricePaise: price, mrpPaise: mrp, weightGrams: Math.round(s.weight(c)), position: n,
          options: { create: s.options.map((o) => ({ optionValueId: ov(o.name, c[o.name]!).id })) } },
      });
      const onHand = s.soldOut?.includes(key) ? 0 : 8 + ((n * 7 + s.slug.length) % 60);
      await prisma.inventoryLevel.create({ data: { variantId: v.id, warehouseId: wh.id, onHand } });
      if (onHand) await prisma.stockMovement.create({ data: { variantId: v.id, warehouseId: wh.id, delta: onHand, reason: "PURCHASE" } });
    }
    made++;
  }
  console.log(`catalog: ${made} new products (${SPECS.length} total specs)`);
}
