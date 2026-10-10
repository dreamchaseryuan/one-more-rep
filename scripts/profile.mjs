// 数据集体检：统计动作规模、筛选维度取值、中文覆盖率
// 用法: node scripts/profile.mjs <exercises.json> <name_zh.json>
import { readFileSync } from 'node:fs';

const [exPath, zhPath] = process.argv.slice(2);
const exercises = JSON.parse(readFileSync(exPath, 'utf8'));
const zhNames = JSON.parse(readFileSync(zhPath, 'utf8'));

const tally = (arr, key) => {
  const m = new Map();
  for (const it of arr) {
    const v = it[key];
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const show = (title, entries, limit = 15) => {
  console.log(`\n## ${title}  (${entries.length} 种)`);
  for (const [k, n] of entries.slice(0, limit)) console.log(`  ${String(n).padStart(5)}  ${k}`);
  if (entries.length > limit) console.log(`  ... 还有 ${entries.length - limit} 种`);
};

console.log(`动作总数: ${exercises.length}`);
console.log(`中文名映射条目: ${Object.keys(zhNames).length}`);

// 字段完整性
const fields = Object.keys(exercises[0]);
const missing = {};
for (const f of fields) {
  const bad = exercises.filter((e) => e[f] == null || e[f] === '' || (Array.isArray(e[f]) && !e[f].length)).length;
  if (bad) missing[f] = bad;
}
console.log(`字段: ${fields.join(', ')}`);
console.log(`空值字段: ${Object.keys(missing).length ? JSON.stringify(missing) : '无'}`);

// 中文覆盖
const zhNameHit = exercises.filter((e) => zhNames[e.name]).length;
const zhInstr = exercises.filter((e) => e.instructions?.zh?.trim().length > 0).length;
const zhSteps = exercises.filter((e) => (e.instruction_steps?.zh ?? []).length > 0).length;
console.log(`\n## 中文覆盖`);
console.log(`  中文名:      ${zhNameHit}/${exercises.length}  (${((zhNameHit / exercises.length) * 100).toFixed(1)}%)`);
console.log(`  中文说明:    ${zhInstr}/${exercises.length}`);
console.log(`  中文分步:    ${zhSteps}/${exercises.length}`);

show('body_part 部位', tally(exercises, 'body_part'));
show('equipment 器械', tally(exercises, 'equipment'), 30);
show('target 目标肌', tally(exercises, 'target'), 25);
show('muscle_group 肌群', tally(exercises, 'muscle_group'));

// 语言覆盖（说明是否所有语言都齐）
console.log(`\n## 语言完整性`);
for (const lang of ['en', 'zh', 'es', 'it', 'tr', 'ru', 'hi', 'pl', 'ko', 'fr']) {
  const n = exercises.filter((e) => e.instructions?.[lang]?.trim().length > 0).length;
  console.log(`  ${lang}: ${n}/${exercises.length}`);
}

// 样例
const s = exercises.find((e) => zhNames[e.name]) ?? exercises[0];
console.log(`\n## 样例记录`);
console.log(JSON.stringify({
  id: s.id, name: s.name, name_zh: zhNames[s.name],
  body_part: s.body_part, equipment: s.equipment, target: s.target,
  muscle_group: s.muscle_group, secondary_muscles: s.secondary_muscles,
  image: s.image, gif_url: s.gif_url, attribution: s.attribution,
  instruction_steps_zh: s.instruction_steps?.zh?.slice(0, 3),
}, null, 2));

// 媒体引用 vs 实际文件（只报引用格式）
console.log(`\n媒体引用示例: image=${exercises[0].image}  gif=${exercises[0].gif_url}`);
