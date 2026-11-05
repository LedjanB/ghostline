// Builds the itch.io HTML5 package: dist/itch/ (folder for butler) and dist/ghostline-itch.zip (for the website upload).
// Run: npm run build:itch
import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'dist', 'itch');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'vendor', 'fonts', 'icons', 'src'];

async function copy(src, dst) {
  const st = await fs.stat(src);
  if (st.isDirectory()) {
    await fs.mkdir(dst, { recursive: true });
    for (const f of await fs.readdir(src)) await copy(path.join(src, f), path.join(dst, f));
  } else await fs.copyFile(src, dst);
}

async function list(dir, base = dir) {
  let out = [];
  for (const f of await fs.readdir(dir)) {
    const p = path.join(dir, f);
    if ((await fs.stat(p)).isDirectory()) out = out.concat(await list(p, base));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

// minimal ZIP writer (deflate), no dependencies
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
async function zip(dir, file) {
  const parts = [], central = [];
  let offset = 0;
  for (const name of await list(dir)) {
    const data = await fs.readFile(path.join(dir, name));
    const comp = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cenSize = central.reduce((t, b) => t + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cenSize, 12); end.writeUInt32LE(offset, 16);
  await fs.writeFile(file, Buffer.concat([...parts, ...central, end]));
}

await fs.rm(path.join(ROOT, 'dist'), { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });
for (const f of INCLUDE) await copy(path.join(ROOT, f), path.join(OUT, f));
// itch.io runs games in an iframe on its own CDN: no service worker there
const html = path.join(OUT, 'index.html');
await fs.writeFile(html, (await fs.readFile(html, 'utf8')).replace(/<script>\s*\/\/ offline support[\s\S]*?<\/script>/, ''));
await zip(OUT, path.join(ROOT, 'dist', 'ghostline-itch.zip'));
const files = await list(OUT);
console.log(`Built dist/itch (${files.length} files) and dist/ghostline-itch.zip`);
