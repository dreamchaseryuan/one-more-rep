// 校验训练模板：动作 ID 是否存在、热身方案名是否有效、结构是否合法。
// 模板写错一个 ID 或方案名，用户点「开始」时才会发现少动作 / 少一段热身 —— 那太晚了。
// 用法: node scripts/check-programs.mjs <programs.json> <warmups.json> <exercises.json>
import { readFileSync } from 'node:fs';

const [progPath, warmPath, exPath] = process.argv.slice(2);
const { programs } = JSON.parse(readFileSync(progPath, 'utf8'));
const { profiles } = JSON.parse(readFileSync(warmPath, 'utf8'));
const exercises = JSON.parse(readFileSync(exPath, 'utf8'));
const byId = new Map(exercises.map((e) => [e.id, e]));

const errors = [];
const warnings = [];
const seenProgramIds = new Set();

let dayCount = 0;
let exCount = 0;
let warmItemCount = 0;

// ── 热身方案本身 ─────────────────────────────────────────────
for (const [key, profile] of Object.entries(profiles)) {
  if (!profile.title) errors.push(`热身方案「${key}」: 缺 title`);
  if (!Array.isArray(profile.items) || !profile.items.length) {
    errors.push(`热身方案「${key}」: items 为空`);
    continue;
  }
  for (const item of profile.items) {
    warmItemCount++;
    if (!item.name || typeof item.name !== 'string') {
      errors.push(`热身方案「${key}」: 有条目缺 name`);
    }
    if (!item.note || typeof item.note !== 'string') {
      errors.push(`热身方案「${key}」/ ${item.name}: 缺 note（要写清做多久或几次）`);
    }
    if (item.exerciseId && !byId.has(item.exerciseId)) {
      errors.push(`热身方案「${key}」/ ${item.name}: 引用的动作 id=${item.exerciseId} 不存在`);
    }
  }
}

// ── 模板 ─────────────────────────────────────────────────────
for (const p of programs) {
  const where = `计划「${p.name}」`;

  if (seenProgramIds.has(p.id)) errors.push(`${where}: 计划 id 重复 (${p.id})`);
  seenProgramIds.add(p.id);

  for (const field of ['id', 'name', 'desc', 'cadence']) {
    if (!p[field]) errors.push(`${where}: 缺字段 ${field}`);
  }
  if (!Array.isArray(p.days) || !p.days.length) {
    errors.push(`${where}: days 为空`);
    continue;
  }

  const usedIds = new Map();
  let anyWarmup = false;

  for (const day of p.days) {
    dayCount++;
    const dayWhere = `${where} 的「${day.name}」`;

    // 热身方案引用
    if (day.warmup === undefined) {
      warnings.push(`${dayWhere}: 没有热身方案`);
    } else if (typeof day.warmup !== 'string') {
      errors.push(`${dayWhere}: warmup 必须是方案名（字符串），模板里不要写死数组`);
    } else if (!profiles[day.warmup]) {
      errors.push(`${dayWhere}: 热身方案「${day.warmup}」不存在`);
    } else {
      anyWarmup = true;
    }

    if (!Array.isArray(day.exercises) || !day.exercises.length) {
      errors.push(`${dayWhere}: 没有动作`);
      continue;
    }

    const inDay = new Set();
    for (const item of day.exercises) {
      exCount++;
      const ex = byId.get(item.exerciseId);
      if (!ex) {
        errors.push(`${dayWhere}: 找不到动作 id=${item.exerciseId}`);
        continue;
      }
      if (inDay.has(item.exerciseId)) errors.push(`${dayWhere}: 动作重复 —— ${ex.nameZh}`);
      inDay.add(item.exerciseId);

      const days = usedIds.get(item.exerciseId) ?? [];
      days.push(day.name);
      usedIds.set(item.exerciseId, days);

      if (!Number.isInteger(item.sets) || item.sets < 1) {
        errors.push(`${dayWhere} / ${ex.nameZh}: sets 非法 (${item.sets})`);
      }
      const [lo, hi] = item.repRange ?? [];
      if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi < lo) {
        errors.push(`${dayWhere} / ${ex.nameZh}: repRange 非法 (${JSON.stringify(item.repRange)})`);
      }
    }
  }

  if (!anyWarmup) warnings.push(`${where}: 所有训练日都没有热身`);

  // 同一动作排到多数训练日 —— 可能是复制粘贴写错了（5x5 的深蹲是有意的）
  for (const [id, days] of usedIds) {
    if (days.length > p.days.length / 2 + 0.5) {
      warnings.push(
        `${where}: 「${byId.get(id)?.nameZh}」出现在 ${days.length}/${p.days.length} 天（${days.join('、')}），确认是有意为之`,
      );
    }
  }

  for (const day of p.days) {
    for (const item of day.exercises) {
      const ex = byId.get(item.exerciseId);
      if (ex && ['band', 'resistance band'].includes(ex.equipment) && item.sets > 4) {
        warnings.push(`${where} / ${ex.nameZh}: 弹力带动作给了 ${item.sets} 组，可能偏多`);
      }
    }
  }
}

console.log(
  `校验 ${programs.length} 个模板、${dayCount} 个训练日、${exCount} 条动作安排、` +
    `${Object.keys(profiles).length} 个热身方案（${warmItemCount} 个条目）`,
);

if (warnings.length) {
  console.log(`\n提醒 ${warnings.length} 条:`);
  for (const w of warnings) console.log(`  ! ${w}`);
}

if (errors.length) {
  console.log(`\n错误 ${errors.length} 条:`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\n全部通过 ✓');
