// 媒体下载：缩略图全量，GIF 可选（默认跳过，体积 123MB）
// 用法: node scripts/fetch-media.mjs <exercises.json> <输出目录> [--videos] [--concurrency=12]
import { readFileSync, mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ensureFetchProxy } from './lib/proxy-bootstrap.mjs';

ensureFetchProxy();

const RAW = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main';
const args = process.argv.slice(2);
const [exPath, outDir] = args;
const wantVideos = args.includes('--videos');
const concurrency = Number(args.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 12);

const exercises = JSON.parse(readFileSync(exPath, 'utf8'));

// images/0001-2gPfomN.jpg → 只需要 jpg 路径；videos 同理
let targets = exercises.map((e) => e.image).filter(Boolean);
if (wantVideos) targets = targets.concat(exercises.map((e) => e.gif).filter(Boolean));

const todo = targets.filter((rel) => !existsSync(join(outDir, rel)));
console.log(`文件总数 ${targets.length}，已存在 ${targets.length - todo.length}，待下载 ${todo.length}`);
if (!todo.length) process.exit(0);

mkdirSync(join(outDir, 'images'), { recursive: true });
if (wantVideos) mkdirSync(join(outDir, 'videos'), { recursive: true });

let done = 0;
let failed = 0;
const total = todo.length;
const t0 = Date.now();

async function fetchOne(rel) {
  const dest = join(outDir, rel);
  mkdirSync(dirname(dest), { recursive: true });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${RAW}/${rel}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 100) throw new Error(`响应过小 ${buf.length}B`);
      writeFileSync(dest, buf);
      done++;
      if (done % 50 === 0 || done === total) {
        const pct = ((done / total) * 100).toFixed(1);
        const secs = (Date.now() - t0) / 1000;
        console.log(`  ${done}/${total}  ${pct}%  ${(secs / done).toFixed(2)}s/个`);
      }
      return;
    } catch (err) {
      if (attempt === 3) {
        failed++;
        console.error(`  失败 ${rel}: ${err.message}`);
      } else {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
}

// 固定并发池
const queue = [...todo];
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length) await fetchOne(queue.shift());
  }),
);

// 校验 + 写清单：前端据此判断哪些媒体本地有，避免缺失时静默渲染成破图
let bytes = 0;
const present = [];
for (const rel of targets) {
  if (existsSync(join(outDir, rel))) {
    bytes += statSync(join(outDir, rel)).size;
    present.push(rel);
  }
}
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ files: present }));
console.log(`\n完成: 成功 ${done}, 失败 ${failed}, 本地 ${present.length}/${targets.length} 个, 共 ${(bytes / 1048576).toFixed(2)} MB`);
console.log(`清单已写入 ${join(outDir, 'index.json')}`);
if (failed) process.exit(1);
