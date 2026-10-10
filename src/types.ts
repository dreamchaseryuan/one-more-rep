/** 精简后的动作记录（由 scripts/build-data.mjs 生成） */
export interface Exercise {
  id: string;
  /** 英文原名，用于英文搜索 */
  name: string;
  /** 清洗后的中文名 */
  nameZh: string;
  bodyPart: string;
  bodyPartZh: string;
  equipment: string;
  equipmentZh: string;
  target: string;
  targetZh: string;
  muscleGroup: string;
  muscleGroupZh: string;
  secondaryMusclesZh: string[];
  /** 中文分步说明 */
  steps: string[];
  /** 相对 public/media 的路径，如 images/0001-2gPfomN.jpg */
  image: string;
  gif: string;
  attribution: string;
  aliases: string[];
}

/** 带搜索索引的动作（运行时构造，不落盘） */
export interface IndexedExercise extends Exercise {
  haystack: string;
}

export type FilterKey = 'bodyPart' | 'equipment' | 'target';

export interface Filters {
  bodyPart: string[];
  equipment: string[];
  target: string[];
}

export const EMPTY_FILTERS: Filters = { bodyPart: [], equipment: [], target: [] };

// ── 训练记录 ─────────────────────────────────────────────────

/** 一组。重量/次数用字符串存 —— 输入框里可以是空的（自主动作）或半输入状态 */
export interface SetEntry {
  weight: string;
  reps: string;
  done: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  /** YYYY-MM-DD，本地日期 */
  date: string;
  entries: LoggedExercise[];
  /** 有值即表示已结束；没有则是进行中的那一次 */
  finishedAt?: string;
}

export type Tab = 'library' | 'log';
