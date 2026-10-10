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
  /**
   * 用户是否动过这一组（填过重量次数，或打过勾）。
   *
   * 必须区分「预填」和「实际做了」：从计划开始训练时，每个动作的组都会预填好
   * 建议重量和次数。如果只看字段非空，那些你根本没练的动作会被当成练了记进历史，
   * 进而污染「上次成绩」和加重建议 —— 这是会误导训练决策的那种错。
   */
  touched?: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  sets: SetEntry[];
}

/** 快照里记下的、当时那个 ProgramDay 规定的一项 */
export interface SnapshotExercise {
  exerciseId: string;
  /** 动作中文名快照 —— 动作从库里下架后历史仍可读 */
  nameZh: string;
  sets: number;
  repRange: [number, number];
}

/**
 * Workout 内嵌的所执行 ProgramDay 快照。见 docs/adr/0001。
 *
 * 故意冗余：Program 会被编辑、Template 会更新、动作会下架。只有把当时的规定整个抄一份，
 * 历史才永远是当时的样子，也才算得出 Deviation（计划 5 组，实际 3 组）。
 * 在**开始训练时**捕获——那一刻之后使用者改了计划，也不该改动这次训练的记载。
 */
export interface WorkoutDaySnapshot {
  programId: string;
  programName: string;
  dayName: string;
  /** 捕获时的训练日下标，仅在按名字找不到时作为退路 */
  dayIndex: number;
  exercises: SnapshotExercise[];
}

export interface Workout {
  id: string;
  /** YYYY-MM-DD，本地日期 */
  date: string;
  entries: LoggedExercise[];
  /** 有值即表示已结束；没有则是进行中的那一次 */
  finishedAt?: string;
  /** 执行的是哪个 ProgramDay。自由训练（不来自计划）时没有这个字段。 */
  day?: WorkoutDaySnapshot;
}

export type Tab = 'library' | 'log';

// ── 热身 ─────────────────────────────────────────────────────

/**
 * 一个热身条目。
 *
 * 带 `exerciseId` 的能点开看动作库的演示动画；动作库里没有的（开合跳、绕环、空杆活动）
 * 就只有文字 —— 那是个健美动作库，不是热身库。
 *
 * 热身**不是训练容量的一部分**：不参与容量统计、不给加重建议、不进「上次成绩」比较。
 */
export interface WarmupItem {
  exerciseId?: string;
  name: string;
  /** "2 分钟" / "每侧 15 次" */
  note: string;
}

// ── 伤病禁忌 ─────────────────────────────────────────────────

/**
 * 使用者给某个 Exercise 打的「这段时间不适合我」标记，通常因为伤病。
 * 不是删除动作：动作仍在库里、仍能搜到，只是不该出现在计划安排里。
 */
export interface Contraindication {
  exerciseId: string;
  /** 从哪天开始，YYYY-MM-DD */
  since: string;
  /** 预计恢复日。到点**不自动解除**，只提示使用者确认 —— 见 isExpired 的说明 */
  until?: string;
  /** "右肩冈上肌" 这类备注 */
  note?: string;
}
