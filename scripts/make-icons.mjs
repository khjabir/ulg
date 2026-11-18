// Draws the ulg logo and writes every icon. Run: npm run icons
// The logo: an endless loop drawn over a board of game-coloured tiles, with an
// orange dot where the line is being drawn (a nod to Zap).
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const IVORY = "#fff8e8";
const INK = "#10201f";
const TILES = ["#2f8f86", "#7b62bb", "#b04a80", "#3176b3", "#c99030", "#66717e", "#e8775e", "#4dbb98"];

function lemniscate(cx, cy, a, steps = 360) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    const d = 1 + Math.sin(t) ** 2;
    pts.push(`${(cx + (a * Math.cos(t)) / d).toFixed(2)},${(cy + (a * Math.sin(t) * Math.cos(t)) / d).toFixed(2)}`);
  }
  return `M${pts.join(" L")}Z`;
}

const DEFS = `<defs>
  <radialGradient id="felt" cx="28%" cy="16%" r="100%">
    <stop offset="0" stop-color="#2c5652"/><stop offset=".55" stop-color="#173533"/><stop offset="1" stop-color="#0c1c1b"/>
  </radialGradient>
  <linearGradient id="loop" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="${IVORY}"/><stop offset="1" stop-color="#f1e0b8"/>
  </linearGradient>
</defs>`;

/** The mark on a 512 canvas, scaled about the centre. */
function mark(scale = 1) {
  let s = `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">`;
  const size = 100;
  const gap = 12;
  const x0 = (512 - (4 * size + 3 * gap)) / 2;
  const y0 = (512 - (2 * size + gap)) / 2;
  // a dark tray under the tiles, so the gaps never show what's behind the logo
  s += `<rect x="${x0 - 12}" y="${y0 - 12}" width="${4 * size + 3 * gap + 24}" height="${2 * size + gap + 32}" rx="34" fill="${INK}"/>`;
  TILES.forEach((c, i) => {
    const x = x0 + (i % 4) * (size + gap);
    const y = y0 + Math.floor(i / 4) * (size + gap);
    s += `<rect x="${x}" y="${y + 8}" width="${size}" height="${size}" rx="24" fill="#000" opacity=".38"/>`;
    s += `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="24" fill="${c}"/>`;
    s += `<rect x="${x + 12}" y="${y + 9}" width="${size - 24}" height="26" rx="13" fill="#fff" opacity=".16"/>`;
  });
  const p = lemniscate(256, 258, 204);
  s += `<path d="${p}" fill="none" stroke="#000" stroke-width="70" stroke-linejoin="round" opacity=".32" transform="translate(0 9)"/>`;
  s += `<path d="${p}" fill="none" stroke="${INK}" stroke-width="66" stroke-linejoin="round"/>`;
  s += `<path d="${p}" fill="none" stroke="url(#loop)" stroke-width="46" stroke-linejoin="round"/>`;
  s += `<circle cx="460" cy="258" r="25" fill="${INK}"/><circle cx="460" cy="258" r="19" fill="#ff8a4c"/>`;
  s += `<circle cx="454" cy="252" r="6" fill="#ffd2b8"/>`;
  return `${s}</g>`;
}

export const logoSvg = ({ rounded = true, scale = 1 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${DEFS}` +
  `<rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#felt)"/>${mark(scale)}</svg>`;

/** The mark alone on a transparent background (README, social images). */
export const markSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="340" viewBox="6 90 500 336">${DEFS}${mark()}</svg>`;

await mkdir("public/icons", { recursive: true });
const rounded = Buffer.from(logoSvg());
const full = Buffer.from(logoSvg({ rounded: false }));
const maskable = Buffer.from(logoSvg({ rounded: false, scale: 0.74 }));

await writeFile("public/logo.svg", logoSvg());
await writeFile("public/logo-mark.svg", markSvg());
await sharp(rounded).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(rounded).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(rounded).resize(32, 32).png().toFile("public/icons/favicon-32.png");
await sharp(maskable).resize(512, 512).png().toFile("public/icons/maskable-512.png");
await sharp(full).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");

// favicon.ico for browsers that ask for it by default: an ICO wrapping PNG images
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((n) => sharp(rounded).resize(n, n).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((n, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(n, e);
  header.writeUInt8(n, e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
await writeFile("public/favicon.ico", Buffer.concat([header, ...pngs]));
console.log("icons written");
