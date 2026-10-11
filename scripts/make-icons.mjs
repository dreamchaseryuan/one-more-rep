// 生成 PWA 图标（哑铃图形）。手写 PNG 编码，不引入图像库。
// 用法: node scripts/make-icons.mjs <输出目录>
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'public/icons';

// ── PNG 编码 ─────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** rgba: Uint8Array 长度 w*h*4 */
function encodePng(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 画图 ─────────────────────────────────────────────────────
const BG = [18, 22, 29, 255]; // 与 styles.css 的 --bg 一致
const FG = [249, 115, 22, 255];

/** 在 canvas 上填一个矩形（按比例坐标） */
function rect(px, size, x0, y0, x1, y1, color) {
  const r = (v) => Math.round(v * size);
  for (let y = r(y0); y < r(y1); y++) {
    for (let x = r(x0); x < r(x1); x++) {
      const i = (y * size + x) * 4;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = color[3];
    }
  }
}

/**
 * 哑铃：中间横杆 + 两侧大小各一片配重。
 * 图形只占中间 70%，给 PWA 的 maskable 裁切换留出安全边距。
 */
function dumbbell(size) {
  const px = new Uint8Array(size * size * 4);
  rect(px, size, 0, 0, 1, 1, BG);
  // 横杆
  rect(px, size, 0.3, 0.465, 0.7, 0.535, FG);
  // 内侧配重片
  rect(px, size, 0.235, 0.325, 0.3, 0.675, FG);
  rect(px, size, 0.7, 0.325, 0.765, 0.675, FG);
  // 外侧配重片
  rect(px, size, 0.15, 0.385, 0.215, 0.615, FG);
  rect(px, size, 0.785, 0.385, 0.85, 0.615, FG);
  return px;
}

mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, encodePng(dumbbell(size), size, size));
  console.log(`OK ${file}`);
}
// iOS 的 apple-touch-icon 用 180×180
const touch = join(outDir, 'apple-touch-icon.png');
writeFileSync(touch, encodePng(dumbbell(180), 180, 180));
console.log(`OK ${touch}`);
