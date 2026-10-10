import type { Workout } from '../types';

const APP_TAG = 'fitness-app';
const VERSION = 1;

export interface Backup {
  app: typeof APP_TAG;
  version: number;
  exportedAt: string;
  workouts: Workout[];
  favorites: string[];
}

export function buildBackup(workouts: Workout[], favorites: string[]): Backup {
  return {
    app: APP_TAG,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    workouts,
    favorites,
  };
}

/** 触发浏览器下载。文件名带日期，好辨认是哪一份。 */
export function downloadBackup(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `健身记录-${backup.exportedAt.slice(0, 10)}.json`;
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

export interface ParseResult {
  backup: Backup | null;
  error: string | null;
  /** 形状不对被丢掉的条数 */
  skipped: number;
}

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { backup: null, error: '不是合法的 JSON 文件', skipped: 0 };
  }
  if (typeof raw !== 'object' || raw === null) {
    return { backup: null, error: '文件内容不是一个对象', skipped: 0 };
  }

  const b = raw as Partial<Backup>;
  if (b.app !== APP_TAG) {
    return { backup: null, error: '这不是本应用的备份文件', skipped: 0 };
  }
  if (!Array.isArray(b.workouts)) {
    return { backup: null, error: '备份里没有 workouts 字段', skipped: 0 };
  }

  const good = b.workouts.filter(isWorkout);
  return {
    backup: {
      app: APP_TAG,
      version: typeof b.version === 'number' ? b.version : VERSION,
      exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
      workouts: good,
      favorites: Array.isArray(b.favorites) ? b.favorites.filter((f) => typeof f === 'string') : [],
    },
    error: null,
    skipped: b.workouts.length - good.length,
  };
}
