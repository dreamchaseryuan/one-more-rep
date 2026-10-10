import type {
  Exercise,
  IndexedExercise,
  SetEntry,
  WarmupItem,
  Workout,
  WorkoutDaySnapshot,
} from '../types';
import rawPrograms from '../../data/programs.json';
import rawWarmups from '../../data/warmups.json';

export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  /** [下限, 上限]。所有组都做到上限 = 该加重量了 */
  repRange: [number, number];
}

export interface ProgramDay {
  name: string;
  focus: string;
  /** 练前的热身。已解析成具体条目 —— 模板里存的是方案名，加载时展开 */
  warmup: WarmupItem[];
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  name: string;
  desc?: string;
  cadence?: string;
  /** 派生自哪个 Template。仅作记录 —— 派生之后与模板再无关联，见 docs/adr/0002 */
  fromTemplate?: string;
  days: ProgramDay[];
}

/** programs.json 里训练日写的是热身**方案名**，加载时展开成条目 */
interface RawDay {
  name: string;
  focus: string;
  warmup?: string;
  exercises: ProgramExercise[];
}
interface RawProgram {
  id: string;
  name: string;
  desc?: string;
  cadence?: string;
  days: RawDay[];
}

/**
 * 热身方案表。抽出来是因为 21 个训练日里有大量重复的通用热身——
 * 每个训练日抄一遍既冗长又容易改漏。使用者在编辑器里改过某天的热身后，
 * 那天会存成显式数组，不再引用方案。
 */
const WARMUP_PROFILES = (
  rawWarmups as unknown as { profiles: Record<string, { title: string; items: WarmupItem[] }> }
).profiles;

function resolveWarmup(name: string | undefined): WarmupItem[] {
  if (!name) return [];
  // 方案名写错时静默返回空，会让模板少一段热身却没人发现 —— 所以 check:programs 会拦下来
  return WARMUP_PROFILES[name]?.items ?? [];
}

/**
 * JSON 里的 repRange 只能是 number[]，推不出 [number, number] 元组，所以这里强制断言。
 * 断言的安全网是 scripts/check-programs.mjs —— 它在构建前校验每个 repRange
 * 确实是两个正整数且 low <= high，不通过就直接 fail 掉构建。
 */
export const PROGRAMS: Program[] = (rawPrograms as unknown as { programs: RawProgram[] }).programs.map(
  (p) => ({
    id: p.id,
    name: p.name,
    desc: p.desc,
    cadence: p.cadence,
    days: p.days.map((d) => ({
      name: d.name,
      focus: d.focus,
      warmup: resolveWarmup(d.warmup),
      exercises: d.exercises,
    })),
  }),
);

export const getProgram = (id: string): Program | undefined => PROGRAMS.find((p) => p.id === id);

/**
 * 加重幅度按器械定 —— 这是现实约束，不是偏好：
 * 杠铃最小片两片共 2.5kg，哑铃通常 2kg 一档，壶铃 4kg 一档。
 * 自主动作加不了重量，只能加次数。
 */
const INCREMENT_KG: Record<string, number> = {
  barbell: 2.5,
  'ez barbell': 2.5,
  'olympic barbell': 2.5,
  'trap bar': 2.5,
  'smith machine': 2.5,
  'leverage machine': 2.5,
  'sled machine': 2.5,
  cable: 2.5,
  dumbbell: 2,
  kettlebell: 4,
  'medicine ball': 1,
  'stability ball': 1,
  weighted: 2.5,
};

/** 这些没有可加的配重片，只能加次数或加难度 */
const NO_WEIGHT = new Set(['body weight', 'band', 'resistance band', 'rope', 'roller', 'wheel roller']);

export function incrementFor(equipment: string): number | null {
  if (NO_WEIGHT.has(equipment)) return null;
  return INCREMENT_KG[equipment] ?? 2.5;
}

export type SuggestionKind = 'new' | 'increase' | 'hold' | 'bodyweight';

export interface Suggestion {
  kind: SuggestionKind;
  /** 给下一个重量；bodyweight/new 时为 null */
  weight: number | null;
  reps: number;
  text: string;
}

/**
 * 基于上次成绩给出这次该上多少重量。
 *
 * 规则就是渐进超负荷最朴素的做法：把次数区间的上限做满，就加一档重量重来。
 * 没做满就维持重量，先把次数补齐 —— 这才是「系统化」的实质。
 */
export function suggestNext(
  exercise: Exercise | undefined,
  repRange: [number, number],
  last: { sets: SetEntry[] } | null,
): Suggestion {
  const [lo, hi] = repRange;
  const equip = exercise?.equipment ?? '';

  if (!last || !last.sets.length) {
    return {
      kind: 'new',
      weight: null,
      reps: hi,
      text: incrementFor(equip) === null
        ? `第一次练，目标 ${hi} 次 × 计划组数`
        : `第一次练，选个能做满 ${lo}~${hi} 次的重量`,
    };
  }

  const weights = last.sets.map((s) => Number(s.weight) || 0);
  const top = Math.max(...weights);

  if (top <= 0) {
    const done = last.sets.map((s) => Number(s.reps) || 0);
    const best = Math.max(...done);
    return {
      kind: 'bodyweight',
      weight: null,
      reps: best + 1,
      text: `上次最多 ${best} 次，这次冲 ${best + 1} 次`,
    };
  }

  const allHitTop = last.sets.every((s) => (Number(s.reps) || 0) >= hi);
  const inc = incrementFor(equip);

  if (allHitTop && inc !== null) {
    return {
      kind: 'increase',
      weight: top + inc,
      reps: hi,
      text: `上次 ${top}kg 做满 ${hi} 次 → 这次 ${top + inc}kg`,
    };
  }

  if (allHitTop && inc === null) {
    return {
      kind: 'bodyweight',
      weight: null,
      reps: hi + 2,
      text: `上次做满 ${hi} 次 → 这次加到 ${hi + 2} 次`,
    };
  }

  const worst = Math.min(...last.sets.map((s) => Number(s.reps) || 0));
  return {
    kind: 'hold',
    weight: top,
    reps: hi,
    text: `上次 ${top}kg 最少只做到 ${worst} 次 → 维持重量，先把 ${hi} 次补齐`,
  };
}

/** 把整天的安排摊开成带建议值的一组记录，供「开始训练」直接填入 */
export interface PlannedExercise {
  exerciseId: string;
  exercise: IndexedExercise | undefined;
  sets: number;
  repRange: [number, number];
  suggestion: Suggestion;
  /** 直接喂给 startWithEntries 的组数据，重量次数已按建议填好 */
  presetSets: SetEntry[];
}

export function planDay(
  day: ProgramDay,
  byId: Map<string, IndexedExercise>,
  lastOf: (exerciseId: string) => { sets: SetEntry[] } | null,
): PlannedExercise[] {
  return day.exercises.map((item) => {
    const exercise = byId.get(item.exerciseId);
    const suggestion = suggestNext(exercise, item.repRange, lastOf(item.exerciseId));
    return {
      exerciseId: item.exerciseId,
      exercise,
      sets: item.sets,
      repRange: item.repRange,
      suggestion,
      presetSets: Array.from({ length: item.sets }, () => ({
        weight: suggestion.weight !== null ? String(suggestion.weight) : '',
        reps: String(suggestion.reps),
        done: false,
      })),
    };
  });
}

export const repRangeText = ([lo, hi]: [number, number]) => (lo === hi ? `${lo} 次` : `${lo}~${hi} 次`);

/** 空杆重量。递增组的第一组从这里开始。 */
const BAR_WEIGHT = 20;
/** 低于这个工作重量就不给递增组了：空杆已经占了太大比例，热身意义不大 */
const RAMP_MIN_WORKING = 40;

export interface RampSet {
  weight: number;
  reps: number;
}

/**
 * 递增组：正式组之前，用同一个动作由轻到重热身。
 *
 * 这是热身里最有价值的一段——一般性热身只升体温，针对性激活只叫醒肌肉，
 * 只有递增组能让神经系统按正式组的重量和轨迹工作一遍。而且它**能算**：
 * 工作重量定了，几组几片就定了。
 *
 * 只显示、不记录 —— 热身组不算容量，也不参与「上次成绩」和加重建议。
 */
export function rampUpSets(workingWeight: number | null): RampSet[] {
  if (workingWeight === null || workingWeight < RAMP_MIN_WORKING) return [];
  const round = (x: number) => Math.max(BAR_WEIGHT, Math.round(x / 2.5) * 2.5);
  const out: RampSet[] = [{ weight: BAR_WEIGHT, reps: 10 }];
  for (const [pct, reps] of [
    [0.4, 5],
    [0.6, 3],
    [0.8, 1],
  ] as const) {
    const w = round(workingWeight * pct);
    // 别给出等于或超过工作重量的「热身组」，也别和上一组重复
    if (w >= workingWeight) continue;
    if (out.some((s) => s.weight === w)) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

export const rampText = (sets: RampSet[]) => sets.map((s) => `${s.weight}×${s.reps}`).join(' → ');

/**
 * 开始训练时把当前计划安排整个抄一份，见 docs/adr/0001。
 *
 * `include` 用来排除这次不打算练的动作（当前是被伤病禁忌挡掉的）。
 * 快照记的是「这次打算练什么」，不是「计划里写了什么」——后者会让历史里
 * 凭空多出一堆没打算做的动作，Deviation 也会因此失真。
 */
export function buildDaySnapshot(
  program: Program,
  dayIndex: number,
  byId: Map<string, IndexedExercise>,
  include?: (exerciseId: string) => boolean,
): WorkoutDaySnapshot {
  const day = program.days[dayIndex];
  const items = include ? day.exercises.filter((e) => include(e.exerciseId)) : day.exercises;
  return {
    programId: program.id,
    programName: program.name,
    dayName: day.name,
    dayIndex,
    exercises: items.map((item) => ({
      exerciseId: item.exerciseId,
      nameZh: byId.get(item.exerciseId)?.nameZh ?? item.exerciseId,
      sets: item.sets,
      repRange: item.repRange,
    })),
  };
}

/** 某个计划下最近一次训练用的是哪个训练日 */
export function lastProgramDay(
  workouts: Workout[],
  programId: string,
): { dayName: string; dayIndex: number } | null {
  let best: Workout | null = null;
  for (const w of workouts) {
    if (!w.finishedAt || w.day?.programId !== programId) continue;
    if (!best || (w.finishedAt > (best.finishedAt ?? ''))) best = w;
  }
  return best?.day ? { dayName: best.day.dayName, dayIndex: best.day.dayIndex } : null;
}

/**
 * 下一个该练的训练日下标。
 *
 * **必须按名字找，不能直接 (lastIndex + 1) % 天数。** 使用者在计划里插入或重排一个训练日之后，
 * 所有历史记录里的下标语义会整体偏移一位，轮转从此错乱——而且不报错，只是安静地让你练错日子。
 * 名字找不到了（训练日被改名或删除）才退回按下标。
 */
export function nextDayIndex(program: Program, last: { dayName: string; dayIndex: number } | null): number {
  if (!last) return 0;
  const byName = program.days.findIndex((d) => d.name === last.dayName);
  if (byName >= 0) return (byName + 1) % program.days.length;
  return (last.dayIndex + 1) % program.days.length;
}
