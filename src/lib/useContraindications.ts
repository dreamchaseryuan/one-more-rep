import { useCallback, useMemo, useState } from 'react';
import { localDate } from './date';
import { usePersist } from './usePersist';
import type { Contraindication } from '../types';

const KEY = 'fitness:contraindications';

function load(): Contraindication[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((c) => c && typeof c.exerciseId === 'string' && typeof c.since === 'string')
      : [];
  } catch {
    return [];
  }
}

export type { Contraindication };

export function useContraindications() {
  const [items, setItems] = useState<Contraindication[]>(load);

  usePersist(KEY, items);

  const byId = useMemo(() => new Map(items.map((c) => [c.exerciseId, c])), [items]);

  const mark = useCallback((exerciseId: string, patch: Omit<Contraindication, 'exerciseId' | 'since'> = {}) => {
    setItems((prev) =>
      prev.some((c) => c.exerciseId === exerciseId)
        ? prev.map((c) => (c.exerciseId === exerciseId ? { ...c, ...patch } : c))
        : [...prev, { exerciseId, since: localDate(), ...patch }],
    );
  }, []);

  const unmark = useCallback((exerciseId: string) => {
    setItems((prev) => prev.filter((c) => c.exerciseId !== exerciseId));
  }, []);

  const markMany = useCallback((exerciseIds: string[], patch: Omit<Contraindication, 'exerciseId' | 'since'> = {}) => {
    setItems((prev) => {
      const have = new Set(prev.map((c) => c.exerciseId));
      const added = exerciseIds.filter((id) => !have.has(id)).map((id) => ({ exerciseId: id, since: localDate(), ...patch }));
      return [...prev, ...added];
    });
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  /** 导入备份用：并集，不覆盖已有的 */
  const merge = useCallback((incoming: Contraindication[]) => {
    setItems((prev) => {
      const have = new Set(prev.map((c) => c.exerciseId));
      return [...prev, ...incoming.filter((c) => c && typeof c.exerciseId === 'string' && !have.has(c.exerciseId))];
    });
  }, []);

  const blocked = useCallback((exerciseId: string) => byId.has(exerciseId), [byId]);
  const get = useCallback((exerciseId: string) => byId.get(exerciseId) ?? null, [byId]);

  return { items, byId, mark, unmark, markMany, clearAll, merge, blocked, get };
}

/**
 * 禁忌是否已过预计恢复日。
 *
 * **到期不自动解除**是故意的：自动解除会在你没注意的时候把受伤动作塞回计划，
 * 这和当初 `touched` 那个 bug 是同一类错误 —— 程序自作主张改用户数据。
 * 界面只提示「还在疼吗？」，解除由你点。
 */
export function isExpired(c: Contraindication, today = localDate()): boolean {
  return !!c.until && c.until < today;
}

export type ContraindicationStore = ReturnType<typeof useContraindications>;
