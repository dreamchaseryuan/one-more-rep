import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LoggedExercise, SetEntry, Workout } from '../types';

const KEY = 'fitness:workouts';

/** 本地日期 YYYY-MM-DD（不能用 toISOString，那是 UTC，晚上练会记成第二天） */
export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const newSet = (): SetEntry => ({ weight: '', reps: '', done: false });

/** 一组是否算「有效记录」——填了重量或次数就算 */
export const isFilled = (s: SetEntry) => s.weight !== '' || s.reps !== '';

/** 容量 = 重量 × 次数。自重动作（没填重量）按 0 计，不污染总量。 */
export function setVolume(s: SetEntry): number {
  const w = Number(s.weight);
  const r = Number(s.reps);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return 0;
  return w * r;
}

export const workoutVolume = (w: Workout) =>
  w.entries.reduce((sum, e) => sum + e.sets.reduce((s, x) => s + setVolume(x), 0), 0);

/** 先按日期、再按结束时间倒序 —— 同一天练两次也要分得清 */
const byRecency = (a: Workout, b: Workout) =>
  b.date.localeCompare(a.date) || (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '');

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(workouts));
  }, [workouts]);

  const current = useMemo(() => workouts.find((w) => !w.finishedAt) ?? null, [workouts]);
  const history = useMemo(() => workouts.filter((w) => w.finishedAt).sort(byRecency), [workouts]);

  /** 改进行中训练的那一条；没有就直接不动 */
  const patchCurrent = useCallback((fn: (w: Workout) => Workout) => {
    setWorkouts((prev) => prev.map((w) => (w.finishedAt ? w : fn(w))));
  }, []);

  const start = useCallback(() => {
    setWorkouts((prev) => {
      if (prev.some((w) => !w.finishedAt)) return prev; // 已有进行中的，不重复开
      const w: Workout = { id: crypto.randomUUID(), date: today(), entries: [] };
      return [...prev, w];
    });
  }, []);

  const discard = useCallback(() => {
    setWorkouts((prev) => prev.filter((w) => w.finishedAt));
  }, []);

  /**
   * 「加入今日训练」——没有进行中的训练就顺手开一次。
   * 必须在同一次 setWorkouts 里完成，否则 start() 和 addExercise() 同批调用时，
   * 后者看不到前者刚建出来的那条记录。
   */
  const startWith = useCallback((exerciseId: string) => {
    setWorkouts((prev) => {
      const active = prev.find((w) => !w.finishedAt);
      const entry: LoggedExercise = { exerciseId, sets: [newSet()] };
      if (active) {
        if (active.entries.some((e) => e.exerciseId === exerciseId)) return prev;
        return prev.map((w) => (w.finishedAt ? w : { ...w, entries: [...w.entries, entry] }));
      }
      return [...prev, { id: crypto.randomUUID(), date: today(), entries: [entry] }];
    });
  }, []);

  const finish = useCallback(() => {
    patchCurrent((w) => ({
      ...w,
      finishedAt: new Date().toISOString(),
      // 把没打的勾也补上，避免记录里留着半空的行
      entries: w.entries
        .map((e) => ({ ...e, sets: e.sets.filter(isFilled) }))
        .filter((e) => e.sets.length > 0),
    }));
  }, [patchCurrent]);

  const addExercise = useCallback(
    (exerciseId: string) => {
      patchCurrent((w) => {
        if (w.entries.some((e) => e.exerciseId === exerciseId)) return w;
        return { ...w, entries: [...w.entries, { exerciseId, sets: [newSet()] }] };
      });
    },
    [patchCurrent],
  );

  const removeExercise = useCallback(
    (exerciseId: string) => {
      patchCurrent((w) => ({ ...w, entries: w.entries.filter((e) => e.exerciseId !== exerciseId) }));
    },
    [patchCurrent],
  );

  const mutateSets = useCallback(
    (exerciseId: string, fn: (sets: SetEntry[]) => SetEntry[]) => {
      patchCurrent((w) => ({
        ...w,
        entries: w.entries.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: fn(e.sets) } : e)),
      }));
    },
    [patchCurrent],
  );

  const updateSet = useCallback(
    (exerciseId: string, index: number, patch: Partial<SetEntry>) =>
      mutateSets(exerciseId, (sets) => sets.map((s, i) => (i === index ? { ...s, ...patch } : s))),
    [mutateSets],
  );

  const addSet = useCallback(
    (exerciseId: string) =>
      mutateSets(exerciseId, (sets) => {
        // 新组默认沿用上一组的重量次数，连续做组时少敲几次键盘
        const last = sets[sets.length - 1];
        return [...sets, last ? { weight: last.weight, reps: last.reps, done: false } : newSet()];
      }),
    [mutateSets],
  );

  const removeSet = useCallback(
    (exerciseId: string, index: number) =>
      mutateSets(exerciseId, (sets) => (sets.length > 1 ? sets.filter((_, i) => i !== index) : sets)),
    [mutateSets],
  );

  /**
   * 导入备份。按 id 去重、只增不改 —— 导入永远不该弄丢或覆盖现有记录。
   * 返回实际新增的条数（在外面算，因为 setState 是异步的，拿不到即时结果）。
   */
  const importWorkouts = useCallback(
    (incoming: Workout[]): number => {
      const existing = new Set(workouts.map((w) => w.id));
      const fresh = incoming.filter((w) => !existing.has(w.id));
      if (fresh.length) setWorkouts((prev) => [...prev, ...fresh.filter((w) => !prev.some((p) => p.id === w.id))]);
      return fresh.length;
    },
    [workouts],
  );

  /** 上次练这个动作时做了什么 —— 渐进超负荷全靠它 */
  const lastPerformance = useCallback(
    (exerciseId: string): { sets: SetEntry[]; date: string } | null => {
      for (const w of history) {
        const e = w.entries.find((x) => x.exerciseId === exerciseId);
        if (e?.sets.length) return { sets: e.sets, date: w.date };
      }
      return null;
    },
    [history],
  );

  /** 历史最重的一组 */
  const bestSet = useCallback(
    (exerciseId: string): SetEntry | null => {
      let best: SetEntry | null = null;
      for (const w of history) {
        for (const e of w.entries) {
          if (e.exerciseId !== exerciseId) continue;
          for (const s of e.sets) {
            if (Number(s.weight) > Number(best?.weight ?? -1)) best = s;
          }
        }
      }
      return best;
    },
    [history],
  );

  /** 某动作每次训练的最大重量，按时间正序 —— 给进步曲线用 */
  const weightHistory = useCallback(
    (exerciseId: string): { date: string; weight: number }[] => {
      // 必须按「日期 → 结束时间」正序。只按日期排的话，同一天练两次顺序不稳定，
      // 曲线会反向，看起来像退步 —— 这是会误导训练决策的那种错。
      const chronological = [...history].sort(
        (a, b) => a.date.localeCompare(b.date) || (a.finishedAt ?? '').localeCompare(b.finishedAt ?? ''),
      );
      const pts: { date: string; weight: number }[] = [];
      for (const w of chronological) {
        const e = w.entries.find((x) => x.exerciseId === exerciseId);
        if (!e) continue;
        const max = Math.max(...e.sets.map((s) => Number(s.weight) || 0));
        if (max > 0) pts.push({ date: w.date, weight: max });
      }
      return pts;
    },
    [history],
  );

  return {
    workouts,
    current,
    history,
    start,
    startWith,
    discard,
    finish,
    importWorkouts,
    addExercise,
    removeExercise,
    updateSet,
    addSet,
    removeSet,
    lastPerformance,
    bestSet,
    weightHistory,
  };
}

export type WorkoutStore = ReturnType<typeof useWorkouts>;
export type { LoggedExercise };
