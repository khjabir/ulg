// Generates the PWA icons in public/icons. Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

// infinity sign: "unlimited"
const mark = `<path d="M50 50c-8-10-14-16-22-16a16 16 0 0 0 0 32c8 0 14-6 22-16s14-16 22-16a16 16 0 0 1 0 32c-8 0-14-6-22-16Z" fill="none" stroke="#1c3f94" stroke-width="11" stroke-linejoin="round"/>`;

function svg({ rounded, tileScale }) {
  const s = 512;
  const t = s * tileScale; // tile size
  const x = (s - t) / 2;
  const y = (s - t) / 2 - t * 0.04;
  const edge = t * 0.075;
  const r = t * 0.2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="felt" cx="30%" cy="15%" r="95%">
      <stop offset="0" stop-color="#2f7a74"/>
      <stop offset="0.6" stop-color="#1f5f5b"/>
      <stop offset="1" stop-color="#174a47"/>
    </radialGradient>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffdf6"/>
      <stop offset="1" stop-color="#fff3d9"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${rounded ? s * 0.22 : 0}" fill="url(#felt)"/>
  <rect x="${x}" y="${y + edge + t * 0.04}" width="${t}" height="${t}" rx="${r}" fill="#0c2e2c" opacity="0.45"/>
  <rect x="${x}" y="${y + edge}" width="${t}" height="${t}" rx="${r}" fill="#dccaa6"/>
  <rect x="${x}" y="${y}" width="${t}" height="${t}" rx="${r}" fill="url(#face)"/>
  <g transform="translate(${x} ${y}) scale(${t / 100})">
    ${mark}
  </g>
</svg>`;
}

await mkdir("public/icons", { recursive: true });
const any = Buffer.from(svg({ rounded: true, tileScale: 0.62 }));
const full = Buffer.from(svg({ rounded: false, tileScale: 0.62 }));
const maskable = Buffer.from(svg({ rounded: false, tileScale: 0.5 }));

await sharp(any).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(any).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(any).resize(32, 32).png().toFile("public/icons/favicon-32.png");
await sharp(maskable).resize(512, 512).png().toFile("public/icons/maskable-512.png");
await sharp(full).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
// favicon.ico for browsers that ask for it by default: an ICO wrapping PNG images
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((n) => sharp(any).resize(n, n).png().toBuffer()));
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
