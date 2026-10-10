import type { Contraindication, Workout } from '../types';
import type { Program } from './programs';
import { localDate } from './date';

const APP_TAG = 'fitness-app';

/**
 * 版本历史：
 *   1 — workouts + favorites
 *   2 — 加入 programId；workouts 里出现 day 快照（见 docs/adr/0001）
 *   3 — 加入 programs（使用者编辑过的计划定义）。
 *       v2 只存了 programId 不存定义，换设备恢复就会把自定义计划全丢掉。
 *   4 — 加入 contraindications（伤病禁忌）。重建一份禁忌表要回忆哪疼、什么时候开始，很烦。
 *       四个版本都能导入，缺的字段取空。
 */
const VERSION = 4;

export interface Backup {
  app: typeof APP_TAG;
  version: number;
  exportedAt: string;
  workouts: Workout[];
  favorites: string[];
  /** 当前跟随的计划 id */
  programId: string | null;
  /** 使用者拥有的计划定义。不带上它，换台设备你的自定义计划就没了。 */
  programs: Program[];
  /** 伤病禁忌 */
  contraindications: Contraindication[];
}

export function buildBackup(
  workouts: Workout[],
  favorites: string[],
  programId: string | null,
  programs: Program[],
  contraindications: Contraindication[],
): Backup {
  return {
    app: APP_TAG,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    workouts,
    favorites,
    programId,
    programs,
    contraindications,
  };
}

/** 触发浏览器下载。文件名带日期，好辨认是哪一份。 */
export function downloadBackup(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // 用本地日期：exportedAt 是 UTC 时间戳，直接截前 10 位会在晚上差一天（见 lib/date.ts）
  a.download = `健身记录-${localDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 单条训练记录的形状校验 —— 导入的文件是外部输入，不能直接信 */
function isWorkout(v: unknown): v is Workout {
  if (typeof v !== 'object' || v === null) return false;
  const w = v as Record<string, unknown>;
  return (
    typeof w.id === 'string' &&
    typeof w.date === 'string' &&
    Array.isArray(w.entries) &&
    w.entries.every((e: unknown) => {
      if (typeof e !== 'object' || e === null) return false;
      const en = e as Record<string, unknown>;
      return (
        typeof en.exerciseId === 'string' &&
        Array.isArray(en.sets) &&
        en.sets.every((s: unknown) => typeof s === 'object' && s !== null)
      );
    })
  );
}

/** 计划定义来自外部文件，只做够用的形状校验，不逐字段深挖 */
function isProgram(v: unknown): v is Program {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    Array.isArray(p.days) &&
    p.days.every((d: unknown) => {
      if (typeof d !== 'object' || d === null) return false;
      const day = d as Record<string, unknown>;
      return typeof day.name === 'string' && Array.isArray(day.exercises);
    })
  );
}

export interface ParseResult {
  backup: Backup | null;
  error: string | null;
  /** 形状不对被丢掉的条数 */
  skipped: number;
  /** 这个备份是什么版本 —— 界面据此提示「这是旧版备份」 */
  fromVersion: number;
}

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { backup: null, error: '不是合法的 JSON 文件', skipped: 0, fromVersion: 0 };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { backup: null, error: '文件内容不是一个对象', skipped: 0, fromVersion: 0 };
  }

  const b = raw as Partial<Backup>;
  if (b.app !== APP_TAG) {
    return { backup: null, error: '这不是本应用的备份文件', skipped: 0, fromVersion: 0 };
  }
  if (!Array.isArray(b.workouts)) {
    return { backup: null, error: '备份里没有 workouts 字段', skipped: 0, fromVersion: 0 };
  }

  const good = b.workouts.filter(isWorkout);
  const fromVersion = typeof b.version === 'number' ? b.version : 1;
  return {
    backup: {
      app: APP_TAG,
      version: VERSION,
      exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
      workouts: good,
      favorites: Array.isArray(b.favorites) ? b.favorites.filter((f) => typeof f === 'string') : [],
      // v1 没有这个字段 —— 缺省成「没选计划」，不要去猜
      programId: typeof b.programId === 'string' ? b.programId : null,
      // v1/v2 都没有计划定义
      programs: Array.isArray(b.programs) ? b.programs.filter(isProgram) : [],
      // v3 及更早没有禁忌
      contraindications: Array.isArray(b.contraindications)
        ? b.contraindications.filter(
            (c) => c && typeof c.exerciseId === 'string' && typeof c.since === 'string',
          )
        : [],
    },
    error: null,
    skipped: b.workouts.length - good.length,
    fromVersion,
  };
}
