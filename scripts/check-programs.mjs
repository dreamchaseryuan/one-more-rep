// 校验训练计划模板：动作 ID 是否都存在、结构是否合法。
// 模板写错一个 ID，用户点「开始」时才会发现少动作 —— 那太晚了。
// 用法: node scripts/check-programs.mjs <programs.json> <exercises.json>
import { readFileSync } from 'node:fs';

const [progPath, exPath] = process.argv.slice(2);
const { programs } = JSON.parse(readFileSync(progPath, 'utf8'));
const exercises = JSON.parse(readFileSync(exPath, 'utf8'));
const byId = new Map(exercises.map((e) => [e.id, e]));

const errors = [];
const warnings = [];
const seenProgramIds = new Set();

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

  const usedIds = new Map(); // exerciseId -> 出现在哪些天
  for (const day of p.days) {
    const dayWhere = `${where} 的「${day.name}」`;
    if (!Array.isArray(day.exercises) || !day.exercises.length) {
      errors.push(`${dayWhere}: 没有动作`);
      continue;
    }

    const inDay = new Set();
    for (const item of day.exercises) {
      const ex = byId.get(item.exerciseId);
      if (!ex) {
        errors.push(`${dayWhere}: 找不到动作 id=${item.exerciseId}`);
        continue;
      }
      if (inDay.has(item.exerciseId)) {
        errors.push(`${dayWhere}: 动作重复 —— ${ex.nameZh}`);
      }
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

  // 同一动作在一个计划里被排到多数训练日 —— 可能是复制粘贴写错了
  for (const [id, days] of usedIds) {
    if (days.length > p.days.length / 2 + 0.5) {
      warnings.push(`${where}: 「${byId.get(id)?.nameZh}」出现在 ${days.length}/${p.days.length} 天（${days.join('、')}），确认是有意为之`);
    }
  }

  // 每个动作的实际可练性：自重动作不可能做 5x5 加重量
  for (const day of p.days) {
    for (const item of day.exercises) {
      const ex = byId.get(item.exerciseId);
      if (ex && ['band', 'resistance band'].includes(ex.equipment) && item.sets > 4) {
        warnings.push(`${where} / ${ex.nameZh}: 弹力带动作给了 ${item.sets} 组，可能偏多`);
      }
    }
  }
}

console.log(`校验 ${programs.length} 个计划、${programs.reduce((n, p) => n + p.days.length, 0)} 个训练日、` +
  `${programs.reduce((n, p) => n + p.days.reduce((m, d) => m + d.exercises.length, 0), 0)} 条动作安排`);

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
