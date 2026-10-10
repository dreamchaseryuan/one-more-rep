import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProgram, type Program } from './programs';

const KEY = 'fitness:program';

interface ProgramState {
  programId: string | null;
}

const EMPTY: ProgramState = { programId: null };

/**
 * 当前选中哪个计划。
 *
 * 这里**故意不存「轮到第几个训练日」**。轮转位置从训练历史推导（见 programs.ts 的 nextDayIndex）——
 * 因为存一份计数器就会和历史出现两份状态，两者一旦不一致（放弃了一次训练、手动换了训练日、
 * 导入备份），就会出错且没人发现。历史是唯一的事实来源。
 */
export function useProgram() {
  const [state, setState] = useState<ProgramState>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      return raw && typeof raw === 'object' && 'programId' in raw ? { ...EMPTY, ...raw } : EMPTY;
    } catch {
      return EMPTY;
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const program: Program | null = state.programId ? getProgram(state.programId) ?? null : null;

  const select = useCallback((programId: string) => setState({ programId }), []);
  const clear = useCallback(() => setState(EMPTY), []);

  return useMemo(() => ({ program, select, clear }), [program, select, clear]);
}

export type ProgramStore = ReturnType<typeof useProgram>;
