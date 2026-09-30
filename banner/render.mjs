#!/usr/bin/env node
// Neo Noir README banner: renders banner-night.svg and banner-paper.svg from the
// design system's tokens.json, its font files and a year of contributions.
//
// Why every word is a <path>: raw.githubusercontent.com serves SVGs with
// `content-security-policy: default-src 'none'; style-src 'unsafe-inline'`,
// so an SVG there cannot load a font. Inline CSS still runs, which is what
// the one animation (film grain) uses.
//
//   node render.mjs                          # reads data/contrib.json
//   GITHUB_TOKEN=… node render.mjs --user SvnFrs   # fetches the last year first
//   node render.mjs --out assets --data data/contrib.json
//   node render.mjs --still                  # no grain flicker (see the note on reduced motion)
//
// Reduced motion: the SVG carries a prefers-reduced-motion rule, and it works when
// the file is opened directly, but Chromium does not apply it inside an <img>, which
// is how GitHub shows it. --still is the way to be sure nothing moves.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const OUT = path.resolve(arg("out", path.join(HERE, "out")));
const DATA = path.resolve(arg("data", path.join(HERE, "data/contrib.json")));
const USER = arg("user", null);
const STILL = process.argv.includes("--still");
const DESIGN = path.join(HERE, "design");
const W = 1200, H = 400;

/* ---------- tokens ---------- */
const tokens = JSON.parse(fs.readFileSync(path.join(DESIGN, "tokens.json"), "utf8"));
const marks = JSON.parse(fs.readFileSync(path.join(DESIGN, "marks.json"), "utf8"));
const byName = Object.fromEntries(
  Object.entries(tokens).flatMap(([fam, v]) =>
    fam === "type" || !v || !Array.isArray(v.tokens) ? [] : v.tokens.map((t) => [t.name, t.value])));
function color(name, theme) {
  let v = byName[name];
  if (v && typeof v === "object") v = v[theme] ?? v[Object.keys(v)[0]];
  const alias = typeof v === "string" && v.match(/^\{(.+)\}$/);
  if (alias) return color(alias[1], theme);
  if (typeof v !== "string") throw new Error("token missing: " + name);
  return v;
}
// "#rrggbbaa" -> { hex: "#rrggbb", a: 0..1 }
function split(hex) {
  const h = hex.replace("#", "");
  return { hex: "#" + h.slice(0, 6), a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
}
const px = (name) => parseFloat(byName[name]);
const num = (name) => Number(byName[name]);

/* ---------- text as outlines ---------- */
// TTF copies of the design system's woff2 files (fontkit cannot instance a
// variable font straight from woff2). Make them once with fonts.py.
const FONT_FILES = {
  display: "BodoniModa-Variable.ttf",
  map: "MartianMono-Variable.ttf",
  ui: "JetBrainsMono-Variable.ttf",
  uiItalic: "JetBrainsMono-Italic-Variable.ttf",
};
const fontCache = new Map();
function face(family, vars) {
  const key = family + JSON.stringify(vars);
  if (!fontCache.has(key)) {
    const base = fontkit.create(fs.readFileSync(path.join(DESIGN, "fonts-ttf", FONT_FILES[family])));
    fontCache.set(key, vars ? base.getVariation(vars) : base);
  }
  return fontCache.get(key);
}
const r2 = (n) => Math.round(n * 100) / 100;
// Returns { d, width } for `str` set at `size` px with its baseline at (x, y).
function text(str, { family = "ui", vars, size = 12, x = 0, y = 0, tracking = 0, anchor = "start" }) {
  const f = face(family, vars);
  const s = size / f.unitsPerEm;
  const run = f.layout(str);
  let adv = 0;
  const placed = run.glyphs.map((g, i) => {
    const p = run.positions[i];
    const at = { g, x: adv + p.xOffset, y: p.yOffset };
    adv += p.xAdvance + tracking * f.unitsPerEm;
    return at;
  });
  const width = (adv - tracking * f.unitsPerEm) * s;
  const x0 = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
  let d = "";
  for (const { g, x: gx, y: gy } of placed) {
    for (const c of g.path.commands) {
      const pts = [];
      for (let k = 0; k < c.args.length; k += 2)
        pts.push(r2(x0 + (gx + c.args[k]) * s) + " " + r2(y - (gy + c.args[k + 1]) * s));
      d += { moveTo: "M", lineTo: "L", quadraticCurveTo: "Q", bezierCurveTo: "C", closePath: "Z" }[c.command] + pts.join(" ");
    }
  }
  return { d, width, x0 };
}
const T = (fill, t, extra = "") => `<path fill="${fill}"${extra} d="${t.d}"/>`;

/* ---------- a year of contributions ---------- */
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
async function fetchYear(login, token) {
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
    weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: "bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { login } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error("GitHub GraphQL: " + JSON.stringify(json.errors || json));
  const days = json.data.user.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount, level: LEVEL[d.contributionLevel] ?? 0 }));
  return { source: "GitHub GraphQL contributionCalendar", days };
}

/* ---------- terrain: contours surveyed from the calendar ---------- */
// The design system's seeded generator (mulberry32 over an FNV-1a hash).
function rng(seed) {
  let h = 2166136261 >>> 0;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function valueNoise(seed, cell) {
  const r = rng(seed), G = new Map();
  const at = (i, j) => { const k = i + "," + j; if (!G.has(k)) G.set(k, r()); return G.get(k); };
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy), u = sm(fx - i), v = sm(fy - j);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function heightfield(days, seed) {
  // GitHub's grid: one column per week (Sunday first), one row per weekday.
  const first = new Date(days[0].date + "T00:00:00Z");
  const lead = first.getUTCDay();
  const cols = Math.ceil((days.length + lead) / 7);
  const maxCount = Math.max(1, ...days.map((d) => d.count ?? 0));
  const cells = days.map((d, i) => {
    const k = i + lead, col = Math.floor(k / 7), row = k % 7;
    const v = d.count != null ? Math.log1p(d.count) / Math.log1p(maxCount) : d.level / 4;
    return { ...d, v, x: ((col + 0.5) / cols) * W, y: ((row + 0.5) / 7) * H };
  });
  const sx = (W / cols) * 2.4, sy = (H / 7) * 1.6;
  const n1 = valueNoise(seed + ":a", 300), n2 = valueNoise(seed + ":b", 140);
  const STEP = 5, NX = W / STEP + 1, NY = H / STEP + 1, F = new Float64Array(NX * NY);
  let hi = 0;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = i * STEP, y = j * STEP;
    let h = 0;
    for (const c of cells) {
      if (!c.v) continue;
      const dx = (x - c.x) / sx, dy = (y - c.y) / sy;
      if (dx * dx + dy * dy < 16) h += c.v * Math.exp(-0.5 * (dx * dx + dy * dy));
    }
    F[j * NX + i] = h; if (h > hi) hi = h;
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = i * STEP, y = j * STEP;
    F[j * NX + i] = 0.8 * (F[j * NX + i] / hi) + 0.16 * n1(x, y) + 0.04 * n2(x, y);
  }
  return { F, NX, NY, STEP, cells };
}
// Marching squares, segments joined into polylines, Chaikin-smoothed.
function contours({ F, NX, NY, STEP }, level) {
  const segs = [];
  const P = (i, j) => F[j * NX + i];
  const lerp = (a, b, va, vb) => a + ((level - va) / (vb - va)) * (b - a);
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    const idx = (a > level) | ((b > level) << 1) | ((c > level) << 2) | ((d > level) << 3);
    if (idx === 0 || idx === 15) continue;
    const x = i * STEP, y = j * STEP;
    const top = [lerp(x, x + STEP, a, b), y], right = [x + STEP, lerp(y, y + STEP, b, c)];
    const bottom = [lerp(x, x + STEP, d, c), y + STEP], left = [x, lerp(y, y + STEP, a, d)];
    const mid = (a + b + c + d) / 4 > level;
    const table = {
      1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bottom]],
      5: mid ? [[left, bottom], [top, right]] : [[left, top], [right, bottom]],
      6: [[top, bottom]], 7: [[left, bottom]], 8: [[bottom, left]], 9: [[bottom, top]],
      10: mid ? [[top, left], [bottom, right]] : [[top, right], [bottom, left]],
      11: [[bottom, right]], 12: [[right, left]], 13: [[right, top]], 14: [[top, left]],
    };
    for (const s of table[idx]) segs.push(s);
  }
  const key = (p) => p[0].toFixed(2) + "," + p[1].toFixed(2);
  const ends = new Map();
  segs.forEach((s, n) => { for (const p of s) { const k = key(p); (ends.get(k) || ends.set(k, []).get(k)).push(n); } });
  const used = new Uint8Array(segs.length), lines = [];
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue;
    used[n] = 1;
    const line = [segs[n][0], segs[n][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const tip = dir ? line[line.length - 1] : line[0];
        const next = (ends.get(key(tip)) || []).find((m) => !used[m]);
        if (next == null) break;
        used[next] = 1;
        const [p, q] = segs[next];
        const far = key(p) === key(tip) ? q : p;
        dir ? line.push(far) : line.unshift(far);
      }
    }
    lines.push(line);
  }
  const chaikin = (pts) => {
    const closed = key(pts[0]) === key(pts[pts.length - 1]);
    const out = closed ? [] : [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [p, q] = [pts[k], pts[k + 1]];
      out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    if (closed) out.push(out[0]); else out.push(pts[pts.length - 1]);
    return out;
  };
  // Douglas-Peucker first, so smoothing works on few points and the file stays small.
  const simplify = (pts, tol) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    let far = 0, at = 0;
    for (let k = 1; k < pts.length - 1; k++) {
      const dist = Math.abs(dy * pts[k][0] - dx * pts[k][1] + b[0] * a[1] - b[1] * a[0]) / L;
      if (dist > far) { far = dist; at = k; }
    }
    if (far <= tol) return [a, b];
    return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
  };
  const len = (pts) => pts.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0), 0);
  return lines
    .filter((l) => len(l) > 60)
    .map((l) => chaikin(chaikin(simplify(l, 1.2))))
    .map((l) => "M" + l.map((p) => Math.round(p[0]) + " " + Math.round(p[1])).join(" "))
    .join("");
}

/* ---------- the sheet ---------- */
function banner(theme, year) {
  const c = (n) => color(n, theme);
  const night = theme === "night";
  const mist = split(c("wash")), key = split(c("keylight")), vig = split(c("vignette"));
  const grainOpacity = num(night ? "grain-night" : "grain-paper");
  const blend = night ? "hard-light" : "multiply";
  const hair = px("stroke-hair"), inkW = px("stroke-ink"), box = px("stroke-box"), slab = px("stroke-slab");
  const days = year.days;
  const surveyed = days[days.length - 1].date;
  const field = heightfield(days, "SvnFrs");

  // Contours: fourteen intervals between the lowest and highest ground; every fifth line is an index line.
  let lo = Infinity, hi = -Infinity;
  for (const v of field.F) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const LEVELS = 14, minor = [], index = [];
  for (let k = 1; k < LEVELS; k++) (k % 5 === 0 ? index : minor).push(contours(field, lo + ((hi - lo) * k) / LEVELS));

  // Spot height: the busiest day as a survey point, only where it lands on open ground.
  // Boxes the name, lead, blocks and legend occupy (x0, y0, x1, y1).
  const TAKEN = [[40, 50, 780, 80], [50, 85, 590, 305], [50, 308, 740, 342], [50, 355, 300, 380], [410, 350, 552, 382], [795, 50, 1170, 250], [812, 255, 1170, 386]];
  const INNER = [22, 30, 1178, 380];
  const hit = (b) => TAKEN.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);
  const inside = (b) => b[0] >= INNER[0] && b[1] >= INNER[1] && b[2] <= INNER[2] && b[3] <= INNER[3];
  const peak = field.cells.reduce((m, d) => (d.v > m.v ? d : m));
  const peakLabel = (peak.count != null ? peak.count + " · " : "") + peak.date;
  const mark = [peak.x - 7, peak.y - 8, peak.x + 7, peak.y + 6];
  let spot = null;
  if (inside(mark) && !hit(mark)) {
    const w = peakLabel.length * 6.6 + 4; // JetBrains Mono at 11px is 6.6px a character
    const tries = [["end", peak.x - 12, peak.y + 4], ["start", peak.x + 12, peak.y + 4], ["end", peak.x + 6, peak.y + 20], ["end", peak.x + 6, peak.y - 12]];
    for (const [anchor, x, y] of tries) {
      const b = anchor === "end" ? [x - w, y - 10, x, y + 3] : [x, y - 10, x + w, y + 3];
      if (inside(b) && !hit(b)) { spot = { anchor, x, y }; break; }
    }
    spot = spot || { anchor: null };
  }

  const ui = (s, o) => text(s, { family: "ui", vars: { wght: 400 }, ...o });
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Tyler, full-stack and cloud engineer, @SvnFrs. A night map of Ho Chi Minh City; its contours are the last year of commits, surveyed ${surveyed}.">`);
  out.push(`<title>Tyler — full-stack &amp; cloud engineer · @SvnFrs</title>`);
  // Grain: five frames of one 256px tile jumping around, dur-grain per loop, cut between frames.
  if (!STILL) out.push(`<style>.gm{animation:gr ${byName["dur-grain"]} steps(1,end) infinite}
@keyframes gr{0%{transform:translate(0,0)}20%{transform:translate(-97px,-41px)}40%{transform:translate(-31px,-173px)}60%{transform:translate(-181px,-89px)}80%{transform:translate(-59px,-223px)}}
@media (prefers-reduced-motion:reduce){.gm{animation:none}}</style>`);
  out.push(`<defs>
<filter id="gn" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="2.6 0 0 0 -.8 2.6 0 0 0 -.8 2.6 0 0 0 -.8 0 0 0 0 1"/></filter>
<pattern id="gp" width="256" height="256" patternUnits="userSpaceOnUse"><rect width="256" height="256" filter="url(#gn)"/></pattern>
<filter id="ash" x="-2%" y="-30%" width="104%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.2 0 0 0 1.75"/><feComposite in="SourceGraphic" operator="in"/><feGaussianBlur stdDeviation="0.3"/></filter>
<filter id="sig" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="4" result="warp"/><feDisplacementMap in="SourceGraphic" in2="warp" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="edge"/><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="9" result="speck"/><feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -7 0 0 0 5.9" result="ink"/><feComposite in="edge" in2="ink" operator="in"/></filter>
<radialGradient id="mist"><stop offset="0" stop-color="${mist.hex}" stop-opacity=".22"/><stop offset=".55" stop-color="${mist.hex}" stop-opacity=".14"/><stop offset="1" stop-color="${mist.hex}" stop-opacity="0"/></radialGradient>
<linearGradient id="key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${key.hex}" stop-opacity="${key.a.toFixed(3)}"/><stop offset=".4" stop-color="${key.hex}" stop-opacity="0"/></linearGradient>
<radialGradient id="vig" cx=".3" cy=".6" r=".9"><stop offset=".55" stop-color="${vig.hex}" stop-opacity="0"/><stop offset="1" stop-color="${vig.hex}" stop-opacity="${vig.a.toFixed(3)}"/></radialGradient>
<clipPath id="card"><polygon points="0,0 1168,0 1200,32 1200,400 0,400"/></clipPath>
</defs>`);
  out.push(`<g clip-path="url(#card)">`);
  out.push(`<rect width="${W}" height="${H}" fill="${c("ground")}"/>`);
  // East: mist, then the surveyed contours.
  out.push(`<ellipse cx="300" cy="150" rx="440" ry="170" fill="url(#mist)"/><ellipse cx="880" cy="300" rx="480" ry="160" fill="url(#mist)"/>`);
  out.push(`<g fill="none" stroke="${c("ash")}" stroke-linecap="round" stroke-linejoin="round"><path stroke-width="${hair}" d="${minor.join("")}"/><path stroke-width="${inkW}" d="${index.join("")}"/></g>`);
  out.push(`<rect width="${W}" height="${H}" fill="url(#key)"/>`);
  // West: the grid and its refs.
  for (const x of [200, 400, 600, 800, 1000]) out.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${c("line")}" stroke-width="${box}"/>`);
  out.push(`<line x1="0" y1="200" x2="${W}" y2="200" stroke="${c("line")}" stroke-width="${box}"/>`);
  "ABCDEF".split("").forEach((l, i) => out.push(T(c("ink-faint"), ui(l, { size: 11, x: i * 200 + 10, y: 22 }))));
  out.push(T(c("ink-faint"), ui("2", { size: 11, x: 10, y: 222 })));
  // West: city blocks and the route.
  for (const [x, y, w, h] of marks.blocks) out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c("slab")}" stroke="${c("line-strong")}" stroke-width="2.5"/>`);
  out.push(`<path d="${marks.route}" fill="none" stroke="${c("ink-faint")}" stroke-width="2.5" stroke-dasharray="7 5"/>`);
  // Spot height at the busiest day, if it landed on open ground.
  if (spot) {
    out.push(`<path d="M${r2(peak.x)} ${r2(peak.y - 6)}l6 10h-12z" fill="none" stroke="${c("ink-muted")}" stroke-width="1.5"/>`);
    if (spot.anchor) out.push(T(c("ink-faint"), ui(peakLabel, { size: 11, x: spot.x, y: spot.y, anchor: spot.anchor })));
  }
  // Neatline: thick, then thin, then the top-right cut.
  out.push(`<rect x="3" y="3" width="1194" height="394" fill="none" stroke="${c("line-strong")}" stroke-width="${slab}"/><rect x="14" y="14" width="1172" height="372" fill="none" stroke="${c("line")}" stroke-width="${hair}"/>`);
  // Sheet refs.
  out.push(T(c("ink-faint"), ui("10°46′N 106°42′E  ·  SHEET 01  ·  HO CHI MINH CITY  ·  1:25 000  ·  SURVEYED " + surveyed, { size: 13, x: 57, y: 72 })));
  // The name, the brush under it, the signature beside it.
  const name = text("Tyler", { family: "display", vars: { wght: 400, opsz: 96 }, size: 184, x: 58, y: 232, tracking: -0.02 });
  out.push(T(c("ink"), name));
  out.push(`<svg x="56" y="288" width="520" height="14" viewBox="0 0 1000 40" preserveAspectRatio="none" overflow="visible"><path d="${marks.brush}" fill="${c("ash")}" filter="url(#ash)"/></svg>`);
  const sx = r2(name.x0 + name.width + 22), glyph = 52 / 100;
  out.push(`<g transform="translate(${sx} 120) scale(${glyph})" fill="${c("ink")}" filter="url(#sig)"><path d="${marks.signature["國"]}"/><path transform="translate(0 104)" d="${marks.signature["泰"]}"/></g>`);
  // Lead and the one annotation.
  const lead = ui("Full-stack & cloud engineer.", { size: 20, x: 60, y: 328 });
  out.push(T(c("ink-muted"), lead));
  out.push(T(c("ink-faint"), text("(code by brain, not by hand)", { family: "uiItalic", vars: { wght: 400 }, size: 17, x: lead.x0 + lead.width + 22, y: 328 })));
  out.push(T(c("accent"), ui("@SvnFrs", { size: 13, x: 58, y: 372 })));
  out.push(T(c("ink-faint"), ui("tyler-void.dev", { size: 13, x: 162, y: 372 })));
  // Scale bar.
  [0, 1, 2, 3, 4].forEach((k) => out.push(`<rect x="${420 + k * 24}" y="358" width="24" height="8" fill="${k % 2 ? "none" : c("ink")}" stroke="${c("ink")}" stroke-width="2"/>`));
  out.push(T(c("ink-faint"), ui("0", { size: 11, x: 420, y: 378 })), T(c("ink-faint"), ui("5 km", { size: 11, x: 545, y: 378, anchor: "end" })));
  // Legend.
  const mono = (s, o) => text(s, { family: "map", vars: { wght: 700, wdth: 112.5 }, ...o });
  out.push(`<rect x="820" y="262" width="340" height="${box}" fill="${c("ink")}"/>`);
  out.push(T(c("ink"), mono("LEGEND", { size: 12, x: 821, y: 284 })));
  // A legend says what each symbol means, so the contours get a row of their own.
  const rows = [
    ["route", "Role", "FULL-STACK & CLOUD"],
    ["block", "Stack", ".NET · GO · PYTHON · TS"],
    ["point", "Base", "ARCH LINUX (BTW)"],
    ["contour", "Terrain", "COMMITS, LAST 365 DAYS"],
  ];
  rows.forEach(([sym, label, value], i) => {
    const y = 306 + i * 22, mid = y - 4;
    out.push(T(c("ink-muted"), ui(label, { size: 12, x: 865, y })), T(c("ink"), ui(value, { size: 12, x: 1160, y, anchor: "end" })));
    if (i < rows.length - 1) out.push(`<rect x="820" y="${y + 7}" width="340" height="1" fill="${c("line")}"/>`);
    if (sym === "route") out.push(`<rect x="820" y="${mid - 1.5}" width="28" height="3" fill="${c("ink")}"/>`);
    if (sym === "block") out.push(`<rect x="821" y="${mid - 6}" width="18" height="12" fill="${c("slab")}" stroke="${c("line-strong")}" stroke-width="2"/>`);
    if (sym === "point") out.push(`<rect x="826" y="${mid - 4}" width="8" height="8" fill="${c("ink")}"/>`);
    if (sym === "contour") out.push(`<path transform="translate(0 ${mid - 359})" d="${marks.legendWave}" fill="none" stroke="${c("ash")}" stroke-width="1.6" stroke-linecap="round"/>`);
  });
  // Light, then film grain: the one moving thing (five frames, off under reduced motion).
  out.push(`<rect width="${W}" height="${H}" fill="url(#vig)"/>`);
  out.push(`<g style="mix-blend-mode:${blend}" opacity="${grainOpacity}"><rect class="gm" x="0" y="0" width="1456" height="656" fill="url(#gp)"/></g>`);
  out.push(`</g>`);
  out.push(`<line x1="1168" y1="0" x2="1200" y2="32" stroke="${c("line-strong")}" stroke-width="4"/>`);
  out.push(`</svg>`);
  return { svg: out.join("\n"), surveyed, peak: peakLabel };
}

/* ---------- run ---------- */
const token = process.env.GITHUB_TOKEN;
let year;
if (USER && token) {
  year = await fetchYear(USER, token);
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, JSON.stringify(year));
} else {
  year = JSON.parse(fs.readFileSync(DATA, "utf8"));
}
fs.mkdirSync(OUT, { recursive: true });
for (const theme of ["night", "paper"]) {
  const { svg, surveyed, peak } = banner(theme, year);
  const file = path.join(OUT, `banner-${theme}.svg`);
  fs.writeFileSync(file, svg);
  console.log(`${file}  ${(svg.length / 1024).toFixed(1)} KB  surveyed ${surveyed}  peak ${peak}`);
}
