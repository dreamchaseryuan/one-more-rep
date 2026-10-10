// 拉取上游原始数据（数据管道与媒体下载的输入）
// 用法: node scripts/fetch-raw.mjs <输出目录>
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ensureFetchProxy } from './lib/proxy-bootstrap.mjs';

ensureFetchProxy();

const outDir = process.argv[2] ?? 'data';

// 中文增强版 fork：数据字段与上游一致，额外带 name_zh.json（中文名映射）
const BASE = 'https://raw.githubusercontent.com/wangmuerxiao/exercises-dataset-zh/master';
const FILES = ['data/exercises.json', 'data/name_zh.json', 'data/exercises.schema.json', 'LICENSE', 'NOTICE.md'];

mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const rel of FILES) {
  const dest = join(outDir, rel.split('/').pop());
  if (existsSync(dest)) {
    console.log(`跳过（已存在）${dest}`);
    continue;
  }
  try {
    const res = await fetch(`${BASE}/${rel}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    console.log(`OK ${dest}  ${(buf.length / 1024).toFixed(0)} KB`);
  } catch (err) {
    failed++;
    console.error(`失败 ${rel}: ${err.message}`);
  }
}

if (failed) process.exit(1);
console.log('\n原始数据就绪，接着跑 npm run data:build');
