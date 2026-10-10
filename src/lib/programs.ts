import type { Exercise, IndexedExercise, SetEntry, Workout, WorkoutDaySnapshot } from '../types';
import raw from '../../data/programs.json';

export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  /** [下限, 上限]。所有组都做到上限 = 该加重量了 */
  repRange: [number, number];
}

export interface ProgramDay {
  name: string;
  focus: string;
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

/**
 * JSON 里的 repRange 只能是 number[]，推不出 [number, number] 元组，所以这里强制断言。
 * 断言的安全网是 scripts/check-programs.mjs —— 它在构建前校验每个 repRange
 * 确实是两个正整数且 low <= high，不通过就直接 fail 掉构建。
 */
export const PROGRAMS: Program[] = (raw as unknown as { programs: Program[] }).programs;

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
