// Studio-style placeholder art (gradient backdrop, shaded bottle, floor shadow) until real photography is uploaded.
export type Kind = "vacuum" | "single-wall" | "copper" | "glass" | "sports" | "kids";

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
function mix(hex: string, to: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(to)];
  return "#" + a.map((v, i) => clamp(v + (b[i]! - v) * t).toString(16).padStart(2, "0")).join("");
}
const lighter = (c: string, t: number) => mix(c, "#ffffff", t);
const darker = (c: string, t: number) => mix(c, "#000000", t);

const defs = (id: string, c: string) =>
  `<linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="${darker(c, 0.35)}"/><stop offset=".22" stop-color="${c}"/><stop offset=".42" stop-color="${lighter(c, 0.38)}"/><stop offset=".7" stop-color="${c}"/><stop offset="1" stop-color="${darker(c, 0.42)}"/></linearGradient>` +
  `<linearGradient id="${id}k" x1="0" x2="1"><stop offset="0" stop-color="#1b2a31"/><stop offset=".4" stop-color="#4a5d66"/><stop offset="1" stop-color="#0f1a20"/></linearGradient>`;

/** One bottle drawn at (cx, base) with the given scale. */
function bottle(kind: Kind, c: string, id: string, cx = 300, base = 530, s = 1, label = "") {
  const w = (kind === "sports" ? 150 : kind === "kids" ? 140 : 160) * s;
  const h = (kind === "sports" ? 300 : kind === "kids" ? 300 : kind === "copper" ? 330 : 380) * s;
  const x = cx - w / 2, top = base - h;
  const body = kind === "glass" ? "url(#" + id + "g)" : `url(#${id}b)`;
  let out = `<g>`;
  if (kind === "glass") {
    out += `<linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#cfe3e8" stop-opacity=".85"/><stop offset=".35" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#b6cfd6" stop-opacity=".85"/></linearGradient>`;
  }
  // body
  out += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="${w * 0.28}" fill="${body}"/>`;
  if (kind === "glass") {
    out += `<rect x="${x + w * 0.05}" y="${top + h * 0.08}" width="${w * 0.9}" height="${h * 0.9}" rx="${w * 0.24}" fill="none" stroke="#9db8c0" stroke-width="2" opacity=".6"/>`;
    out += `<rect x="${x - 2 * s}" y="${top + h * 0.45}" width="${w + 4 * s}" height="${h * 0.38}" rx="${14 * s}" fill="${c}"/>`;
    out += `<circle cx="${cx - 18 * s}" cy="${top + h * 0.28}" r="${14 * s}" fill="#f4b73f" opacity=".85"/><circle cx="${cx + 16 * s}" cy="${top + h * 0.22}" r="${11 * s}" fill="#7bc47f" opacity=".85"/>`;
  }
  if (kind === "copper") out += Array.from({ length: 28 }, (_, i) => `<circle cx="${x + 18 * s + ((i * 37) % 120) * s}" cy="${top + 40 * s + Math.floor(i / 4) * 40 * s}" r="${7 * s}" fill="${lighter(c, 0.25)}" opacity=".35"/>`).join("");
  // shine
  out += `<rect x="${x + w * 0.14}" y="${top + h * 0.12}" width="${w * 0.07}" height="${h * 0.7}" rx="${w * 0.035}" fill="#fff" opacity=".4"/>`;
  // band + label
  if (kind !== "glass" && kind !== "copper") out += `<rect x="${x}" y="${top + h * 0.55}" width="${w}" height="${h * 0.06}" fill="${darker(c, 0.25)}" opacity=".35"/>`;
  if (label && kind !== "kids") out += `<text x="${cx}" y="${top + h * 0.45}" font-family="Georgia,serif" font-size="${26 * s}" text-anchor="middle" fill="#fff" opacity=".92">${label}</text>`;
  // caps
  const neck = (nw: number, nh: number, fill: string) => `<rect x="${cx - nw / 2}" y="${top - nh + 6 * s}" width="${nw}" height="${nh}" rx="${10 * s}" fill="${fill}"/>`;
  if (kind === "sports") {
    out += neck(w * 0.7, 38 * s, `url(#${id}k)`) + `<path d="M${cx + 10 * s} ${top - 32 * s} q${34 * s} ${-70 * s} ${58 * s} ${-60 * s}" stroke="#1b2a31" stroke-width="${10 * s}" fill="none" stroke-linecap="round"/>`;
  } else if (kind === "kids") {
    out += neck(w * 0.5, 54 * s, "#f4b73f") + `<rect x="${cx - 7 * s}" y="${top - 74 * s}" width="${14 * s}" height="${24 * s}" rx="${7 * s}" fill="#d98f12"/>`;
    // friendly face
    out += `<circle cx="${cx - 26 * s}" cy="${top + h * 0.38}" r="${9 * s}" fill="#1b2a31"/><circle cx="${cx + 26 * s}" cy="${top + h * 0.38}" r="${9 * s}" fill="#1b2a31"/><path d="M${cx - 22 * s} ${top + h * 0.48} q${22 * s} ${22 * s} ${44 * s} 0" stroke="#1b2a31" stroke-width="${6 * s}" fill="none" stroke-linecap="round"/><circle cx="${cx - 46 * s}" cy="${top + h * 0.47}" r="${9 * s}" fill="#f08a8a" opacity=".6"/><circle cx="${cx + 46 * s}" cy="${top + h * 0.47}" r="${9 * s}" fill="#f08a8a" opacity=".6"/>`;
  } else {
    out += `<rect x="${cx - w * 0.31}" y="${top - 30 * s}" width="${w * 0.62}" height="${26 * s}" rx="${8 * s}" fill="${darker(c, 0.2)}"/><rect x="${cx - w * 0.2}" y="${top - 58 * s}" width="${w * 0.4}" height="${34 * s}" rx="${9 * s}" fill="url(#${id}k)"/>`;
  }
  return out + `</g>`;
}

const stage = (inner: string, c: string, id: string, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs>${defs(id, c)}` +
  
  `<radialGradient id="${id}sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>` +
  `<rect width="600" height="600" fill="#f3f2ef"/>${extra}<ellipse cx="300" cy="536" rx="150" ry="22" fill="url(#${id}sh)"/>${inner}</svg>`;

export function bottleSvg(color: string, label: string, kind: Kind) {
  return stage(bottle(kind, color, "a", 300, 532, 1, label), color, "a");
}

const TILE: Record<Kind, { c: string; bg: string; text: string }> = {
  vacuum: { c: "#2a8c8c", bg: "#d9eeee", text: "Vacuum Thermosteel" }, "single-wall": { c: "#8c949a", bg: "#e6e9ec", text: "Single-Wall Steel" },
  copper: { c: "#b87333", bg: "#f6e4d2", text: "Copper Bottles" }, glass: { c: "#4aa3b5", bg: "#dff1f5", text: "Glass Bottles" },
  sports: { c: "#2f6fb0", bg: "#dbe8f6", text: "Sports Sippers" }, kids: { c: "#e8a0b4", bg: "#fbe5ec", text: "Kids Flasks" },
};

export function categorySvg(kind: Kind) {
  const t = TILE[kind];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs>${defs("t", t.c)}<radialGradient id="tsh"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="600" height="600" fill="#f3f2ef"/>` +
    `<ellipse cx="300" cy="545" rx="130" ry="18" fill="url(#tsh)"/>${bottle(kind, t.c, "t", 300, 540, 1.05)}</svg>`;
}

/** Transparent so it sits on the navy hero: three bottles grouped. */
export function heroSvg() {
  const g = (k: Kind, c: string, id: string, cx: number, base: number, s: number) => `<defs>${defs(id, c)}</defs>${bottle(k, c, id, cx, base, s)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 700"><defs><radialGradient id="hg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e8806b" stop-opacity=".45"/><stop offset="1" stop-color="#e8806b" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="hs"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>` +
    `<ellipse cx="400" cy="640" rx="330" ry="26" fill="url(#hs)"/>` +
    g("sports", "#2f6fb0", "h1", 195, 640, 1) + g("copper", "#b87333", "h3", 605, 640, 1.05) + g("vacuum", "#e8a0b4", "h2", 400, 650, 1.32) + `</svg>`;
}

/** Large single-product showcase for the home hero: metallic body, ringed cap, specular streak, soft floor shadow. Transparent background. */
export function showcaseSvg(kind: Kind, color: string) {
  const id = "s", W = 800, H = 700, cx = 400, base = 610;
  const dk = darker(color, 0.45), md = color, lt = lighter(color, 0.55), hi = lighter(color, 0.85);
  const grad = (n: string, stops: [number, string][]) => `<linearGradient id="${id}${n}" x1="0" x2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`;
  const metal = grad("m", [[0, dk], [0.12, md], [0.3, lt], [0.38, hi], [0.5, lt], [0.78, md], [1, dk]]);
  const cap = grad("c", [[0, "#10181d"], [0.3, "#3b4b54"], [0.42, "#5d717b"], [0.6, "#2c3a42"], [1, "#0b1115"]]);
  const w = kind === "sports" ? 190 : kind === "kids" ? 180 : kind === "glass" ? 190 : kind === "copper" ? 210 : 170;
  const h = kind === "sports" ? 380 : kind === "kids" ? 340 : kind === "copper" ? 440 : kind === "glass" ? 430 : 500;
  const x = cx - w / 2, top = base - h, r = w * 0.2;
  let out = `<ellipse cx="${cx}" cy="${base + 8}" rx="${w * 0.8}" ry="20" fill="url(#${id}sh)"/>`;
  if (kind === "glass") {
    out += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="${r}" fill="#dcecf0" fill-opacity=".55" stroke="#a9c3cb" stroke-width="3"/>`;
    out += `<rect x="${x + 10}" y="${top + h * 0.42}" width="${w - 20}" height="${h * 0.54}" rx="${r * 0.7}" fill="${color}" fill-opacity=".75"/>`;
    out += `<circle cx="${cx - 30}" cy="${top + h * 0.3}" r="20" fill="#f4b73f"/><circle cx="${cx + 26}" cy="${top + h * 0.22}" r="16" fill="#7bc47f"/><circle cx="${cx + 4}" cy="${top + h * 0.34}" r="13" fill="#e8806b"/>`;
    out += `<rect x="${x + 18}" y="${top + 20}" width="12" height="${h - 60}" rx="6" fill="#fff" opacity=".7"/>`;
  } else {
    out += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="${r}" fill="url(#${id}m)"/>`;
    out += `<rect x="${x + w * 0.16}" y="${top + 26}" width="${w * 0.07}" height="${h - 70}" rx="${w * 0.035}" fill="#fff" opacity=".45"/>`;
    out += `<rect x="${x}" y="${top + h * 0.12}" width="${w}" height="3" fill="${dk}" opacity=".35"/><rect x="${x}" y="${base - 56}" width="${w}" height="3" fill="${dk}" opacity=".35"/>`;
    if (kind === "copper") out += Array.from({ length: 40 }, (_, i) => `<circle cx="${x + 18 + ((i * 53) % (w - 36))}" cy="${top + 30 + Math.floor(i / 5) * 46}" r="9" fill="${lighter(color, 0.3)}" opacity=".28"/>`).join("");
    if (kind === "vacuum" || kind === "single-wall") out += `<text x="${cx}" y="${top + h * 0.5 + 31}" font-family="Georgia,serif" font-size="26" letter-spacing="4" text-anchor="middle" fill="#fff" opacity=".9">NESTORA</text>`;
    if (kind === "kids") out += `<circle cx="${cx - 34}" cy="${top + h * 0.45}" r="11" fill="#1b2a31"/><circle cx="${cx + 34}" cy="${top + h * 0.45}" r="11" fill="#1b2a31"/><path d="M${cx - 28} ${top + h * 0.56} q28 26 56 0" stroke="#1b2a31" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  }
  // lid
  if (kind === "sports") {
    out += `<rect x="${cx - w * 0.36}" y="${top - 46}" width="${w * 0.72}" height="50" rx="12" fill="url(#${id}c)"/><path d="M${cx + 16} ${top - 44} q60 -110 110 -92" stroke="#10181d" stroke-width="14" fill="none" stroke-linecap="round"/>`;
  } else if (kind === "kids") {
    out += `<rect x="${cx - w * 0.3}" y="${top - 62}" width="${w * 0.6}" height="68" rx="16" fill="#f4b73f"/><rect x="${cx - 12}" y="${top - 98}" width="24" height="40" rx="12" fill="#d98f12"/>`;
  } else {
    out += `<rect x="${cx - w * 0.36}" y="${top - 20}" width="${w * 0.72}" height="26" rx="6" fill="${dk}"/>`;
    out += `<rect x="${cx - w * 0.3}" y="${top - 84}" width="${w * 0.6}" height="70" rx="14" fill="url(#${id}c)"/>` + [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${cx - w * 0.3 + 10 + i * ((w * 0.6 - 20) / 5.5)}" y="${top - 76}" width="3" height="54" fill="#fff" opacity=".1"/>`).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs>${metal}${cap}<radialGradient id="${id}sh"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>${out}</svg>`;
}
