// 数据管道：合并中文名 → 清洗 → 裁剪语言 → 生成前端用的精简数据集
// 用法: node scripts/build-data.mjs <exercises.json> <name_zh.json> <terms_zh.json> <输出路径>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [exPath, zhPath, termsPath, outPath, overridePath] = process.argv.slice(2);
const exercises = JSON.parse(readFileSync(exPath, 'utf8'));
const zhNames = JSON.parse(readFileSync(zhPath, 'utf8'));
const terms = JSON.parse(readFileSync(termsPath, 'utf8'));
// 人工校正表：{ "动作id": "改好的中文名" } —— 只覆盖确实需要人手判断的极少条目
const overrides = overridePath ? JSON.parse(readFileSync(overridePath, 'utf8')) : {};

// ── 中文名清洗 ───────────────────────────────────────────────
// 机器翻译的痕迹是「词与词之间塞了空格」：「辅助 仰卧 抬腿带侧向 下摆」
// 但字母不能删 ——「弹力带 V 字起身」里的 V 是形状描述，有意义。
// 规则：只删中文字符（含中文标点）之间的空格，中文↔拉丁/数字之间的空格保留。
const CJK = String.raw`一-鿿　-〿＀-￯`;
const PUNCT = String.raw`()（）,，、/\\`;
// 只匹配「空格本身」，用环视断言两侧，替换为空串（避免捕获组在分支里失配）
const CJK_CJK_SPACE = new RegExp(`(?<=[${CJK}])[ \\t]+(?=[${CJK}])`, 'g');
const CJK_PUNCT_SPACE = new RegExp(`(?<=[${CJK}])[ \\t]+(?=[${PUNCT}])|(?<=[${PUNCT}])[ \\t]+(?=[${CJK}])`, 'g');

const removedFragments = [];

// 翻译碎片：英文复数/介词的残骸被留在了中文里
//   "legs" → 「直腿s」  "raised" → 「带抬腿d」  "over a bench" → 「过a 凳」
// 判据：拉丁串 ≤2 字符、全小写、且与中文相邻。大写保留 —— V/Y/T 是形状，JM 是动作专名。
function stripResidue(s, id) {
  return s.replace(/[A-Za-z]+/g, (word, offset) => {
    if (word.length > 2 || word !== word.toLowerCase()) return word;
    const before = s.slice(0, offset).trimEnd();
    const after = s.slice(offset + word.length).trimStart();
    const touchesCJK = new RegExp(`[${CJK}]$`).test(before) || new RegExp(`^[${CJK}]`).test(after);
    if (!touchesCJK) return word;
    removedFragments.push({ id, fragment: word });
    return '';
  });
}

// 反复替换，处理连续多空格
const collapse = (s, re) => {
  let prev;
  do {
    prev = s;
    s = s.replace(re, '');
  } while (s !== prev);
  return s;
};

function cleanName(raw, id) {
  let s = stripResidue(raw, id);
  s = collapse(s, CJK_CJK_SPACE);
  s = collapse(s, CJK_PUNCT_SPACE);
  return s.replace(/\s+/g, ' ').trim();
}

// 需要人工校正的名单 —— 检查「清洗后的最终结果」，不是原始串
const suspects = [];
function flagIfSuspect(orig, final, id) {
  const reasons = [];
  if (!/[一-鿿]/.test(final)) reasons.push('无中文');
  // 清洗后仍夹在中文之间的小写字母 = 规则没覆盖到的残留
  const stray = [...final.matchAll(/(?<=[一-鿿])\s*([a-z]{1,2})\s*(?=[一-鿿])/g)].map((m) => m[1]);
  if (stray.length) reasons.push(`残留小写:${stray.join(',')}`);
  if (final.length > 20) reasons.push('过长');
  if (reasons.length) suspects.push({ id, orig, final, reasons });
}

// ── 术语翻译（缺失即报错，便于补字典）─────────────────────────
const missingTerms = { body_part: new Set(), equipment: new Set(), target: new Set(), muscle_group: new Set() };
const tr = (kind, value) => {
  const hit = terms[kind]?.[value];
  if (!hit) missingTerms[kind].add(value);
  return hit ?? value;
};

// ── 生成记录 ─────────────────────────────────────────────────
const out = [];
for (const e of exercises) {
  const rawZh = zhNames[e.name] ?? '';
  const nameZh = overrides[e.id] ?? cleanName(rawZh, e.id);
  flagIfSuspect(rawZh, nameZh, e.id);

  const stepsZh = (e.instruction_steps?.zh ?? []).map((s) => s.trim()).filter(Boolean);
  // 没有分步就退回整段说明，至少保证有内容
  const steps = stepsZh.length ? stepsZh : [e.instructions?.zh ?? ''].filter(Boolean);

  out.push({
    id: e.id,
    name: e.name,
    nameZh: nameZh || e.name,
    bodyPart: e.body_part,
    bodyPartZh: tr('body_part', e.body_part),
    equipment: e.equipment,
    equipmentZh: tr('equipment', e.equipment),
    target: e.target,
    targetZh: tr('target', e.target),
    muscleGroup: e.muscle_group,
    muscleGroupZh: tr('muscle_group', e.muscle_group),
    secondaryMusclesZh: (e.secondary_muscles ?? []).map((m) => tr('muscle_group', m)),
    steps,
    image: e.image,
    gif: e.gif_url,
    attribution: e.attribution,
    // 预留：人工校正 / 别名，便于搜索「卧推」「深蹲」
    aliases: [],
  });
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out), 'utf8');

// ── 报告 ─────────────────────────────────────────────────────
console.log(`生成 ${out.length} 条 → ${outPath}`);
console.log(`体积: ${(JSON.stringify(out).length / 1024 / 1024).toFixed(2)} MB`);

let hasMissing = false;
for (const [kind, set] of Object.entries(missingTerms)) {
  if (set.size) {
    hasMissing = true;
    console.log(`\n[缺翻译] ${kind} (${set.size} 个):`);
    for (const v of set) console.log(`  "${v}": "",`);
  }
}
if (!hasMissing) console.log('\n术语字典完整 ✓');

if (removedFragments.length) {
  console.log(`\n[已清除翻译碎片] ${removedFragments.length} 处，全部列出以便核对:`);
  for (const r of removedFragments) console.log(`  ${r.id}  删掉 "${r.fragment}"`);
}

console.log(`\n[待校正中文名] ${suspects.length}/${out.length} 条`);
for (const s of suspects.slice(0, 40)) {
  console.log(`  ${s.id}  ${s.orig}  →  ${s.final}   (${s.reasons.join('/')})`);
}
