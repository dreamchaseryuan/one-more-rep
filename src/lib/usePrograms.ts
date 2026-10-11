import { useCallback, useMemo, useState } from 'react';
import { getProgram, PROGRAMS, type Program, type ProgramDay } from './programs';
import { usePersist } from './usePersist';
import type { WarmupItem } from '../types';

const KEY = 'fitness:programs';
const LEGACY_KEY = 'fitness:program';

interface State {
  /** 归使用者所有的计划。Template 只是派生它们的起点。 */
  programs: Program[];
  activeProgramId: string | null;
}

const EMPTY: State = { programs: [], activeProgramId: null };

/**
 * 给派生出来的计划起 id。
 *
 * 优先直接用模板 id（`ppl`），这样**旧历史记录里存的 programId 能自动接上**——
 * 迁移前记的训练，快照里写的是模板 id。重名时才退到 `ppl-2`、`ppl-3`。
 */
function deriveId(templateId: string, taken: Set<string>): string {
  if (!taken.has(templateId)) return templateId;
  let n = 2;
  while (taken.has(`${templateId}-${n}`)) n++;
  return `${templateId}-${n}`;
}

function fromTemplate(templateId: string, taken: Set<string>): Program | null {
  const tpl = getProgram(templateId);
  if (!tpl) return null;
  return {
    ...structuredClone(tpl),
    id: deriveId(templateId, taken),
    fromTemplate: templateId,
  };
}

/**
 * 补齐旧数据缺的字段。
 *
 * 热身的字段是后加的，之前存下来的计划里没有 —— 不补的话 `day.warmup.map` 会直接崩，
 * 而且是使用者打开应用那一刻才崩。凡是往 ProgramDay 上加必填字段，都要在这里补一次。
 */
function normalize(p: Program): Program {
  return {
    ...p,
    days: (p.days ?? []).map((d) => ({ ...d, warmup: Array.isArray(d.warmup) ? d.warmup : [] })),
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      if (Array.isArray(parsed.programs)) {
        return {
          programs: parsed.programs
            .filter((p) => p && typeof p.id === 'string' && Array.isArray(p.days))
            .map(normalize),
          activeProgramId: typeof parsed.activeProgramId === 'string' ? parsed.activeProgramId : null,
        };
      }
    }

    // 迁移旧版：那时只存了一个指向内置模板的 programId，没有可编辑的副本
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const { programId } = JSON.parse(legacy) as { programId?: string };
      const derived = programId ? fromTemplate(programId, new Set()) : null;
      if (derived) return { programs: [derived], activeProgramId: derived.id };
    }
  } catch {
    // 存储坏了就当没有，不要因此让整个应用起不来
  }
  return EMPTY;
}

export function usePrograms() {
  const [state, setState] = useState<State>(load);

  // 计划编辑器里改一个名字、调一个组数都会走这里，和训练记录同理
  usePersist(KEY, state);

  const program = useMemo(
    () => state.programs.find((p) => p.id === state.activeProgramId) ?? null,
    [state],
  );

  const createFromTemplate = useCallback((templateId: string) => {
    setState((s) => {
      const derived = fromTemplate(templateId, new Set(s.programs.map((p) => p.id)));
      if (!derived) return s;
      return { programs: [...s.programs, derived], activeProgramId: derived.id };
    });
  }, []);

  const createBlank = useCallback(() => {
    setState((s) => {
      const id = deriveId('mine', new Set(s.programs.map((p) => p.id)));
      const blank: Program = {
        id,
        name: '我的计划',
        days: [{ name: '第一天', focus: '', warmup: [], exercises: [] }],
      };
      return { programs: [...s.programs, blank], activeProgramId: id };
    });
  }, []);

  const setActive = useCallback((id: string) => setState((s) => ({ ...s, activeProgramId: id })), []);

  const rename = useCallback((id: string, name: string) => {
    setState((s) => ({ ...s, programs: s.programs.map((p) => (p.id === id ? { ...p, name } : p)) }));
  }, []);

  const remove = useCallback((id: string) => {
    setState((s) => {
      const programs = s.programs.filter((p) => p.id !== id);
      return {
        programs,
        // 删掉的正好是当前选中的，就落到第一个；一个都不剩就回到「选模板」界面
        activeProgramId: s.activeProgramId === id ? (programs[0]?.id ?? null) : s.activeProgramId,
      };
    });
  }, []);

  /** 从模板重新派生一份，丢弃对当前计划的所有编辑 */
  const resetFromTemplate = useCallback((id: string) => {
    setState((s) => {
      const target = s.programs.find((p) => p.id === id);
      if (!target?.fromTemplate) return s;
      const tpl = getProgram(target.fromTemplate);
      if (!tpl) return s;
      // 保留 id 与名字，只把内容换回模板 —— 否则历史里的 programId 会断
      const fresh: Program = { ...structuredClone(tpl), id: target.id, name: target.name, fromTemplate: target.fromTemplate };
      return { ...s, programs: s.programs.map((p) => (p.id === id ? fresh : p)) };
    });
  }, []);

  /** 编辑当前计划。所有增删改都走这一个入口，保证不会漏改 activeProgramId。 */
  const editActive = useCallback((fn: (p: Program) => Program) => {
    setState((s) => ({
      ...s,
      programs: s.programs.map((p) => (p.id === s.activeProgramId ? fn(p) : p)),
    }));
  }, []);

  // ── 当前计划的编辑操作 ────────────────────────────────────
  const mapDays = (fn: (days: ProgramDay[]) => ProgramDay[]) =>
    editActive((p) => ({ ...p, days: fn(p.days) }));

  const mapDay = (dayIndex: number, fn: (d: ProgramDay) => ProgramDay) =>
    mapDays((days) => days.map((d, i) => (i === dayIndex ? fn(d) : d)));

  const setProgramName = useCallback((name: string) => editActive((p) => ({ ...p, name })), [editActive]);
  const setProgramDesc = useCallback((desc: string) => editActive((p) => ({ ...p, desc })), [editActive]);

  const addDay = useCallback(
    () =>
      mapDays((days) => [
        ...days,
        { name: `训练日 ${days.length + 1}`, focus: '', warmup: [], exercises: [] },
      ]),
    [mapDays],
  );
  const removeDay = useCallback(
    // 至少留一天，否则界面无处可去
    (i: number) => mapDays((days) => (days.length > 1 ? days.filter((_, x) => x !== i) : days)),
    [mapDays],
  );
  const setDayName = useCallback(
    (i: number, name: string) => mapDay(i, (d) => ({ ...d, name })),
    [mapDay],
  );
  const setDayFocus = useCallback((i: number, focus: string) => mapDay(i, (d) => ({ ...d, focus })), [mapDay]);

  const moveDay = useCallback(
    (i: number, dir: -1 | 1) =>
      mapDays((days) => {
        const j = i + dir;
        if (j < 0 || j >= days.length) return days;
        const next = [...days];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
    [mapDays],
  );

  // ── 热身 ──────────────────────────────────────────────────
  // 一旦编辑，这一天就从「引用热身方案」变成存显式数组，之后不再跟方案走
  const addWarmup = useCallback(
    (dayIndex: number) =>
      mapDay(dayIndex, (d) => ({ ...d, warmup: [...d.warmup, { name: '', note: '' }] })),
    [mapDay],
  );

  /**
   * 从动作库挑一个热身动作追加进去。
   * 必须是一个原子操作 —— 分两步调用（先加空条目、再回填）的话，
   * 第二次改动在同一次 React 批处理里看不到第一条刚建出来的条目。
   */
  const addWarmupFromLibrary = useCallback(
    (dayIndex: number, exerciseId: string, name: string) =>
      mapDay(dayIndex, (d) => ({
        ...d,
        warmup: [...d.warmup, { exerciseId, name, note: '' }],
      })),
    [mapDay],
  );

  const removeWarmup = useCallback(
    (dayIndex: number, i: number) =>
      mapDay(dayIndex, (d) => ({ ...d, warmup: d.warmup.filter((_, x) => x !== i) })),
    [mapDay],
  );

  const moveWarmup = useCallback(
    (dayIndex: number, i: number, dir: -1 | 1) =>
      mapDay(dayIndex, (d) => {
        const j = i + dir;
        if (j < 0 || j >= d.warmup.length) return d;
        const next = [...d.warmup];
        [next[i], next[j]] = [next[j], next[i]];
        return { ...d, warmup: next };
      }),
    [mapDay],
  );

  const setWarmup = useCallback(
    (dayIndex: number, i: number, patch: Partial<WarmupItem>) =>
      mapDay(dayIndex, (d) => ({
        ...d,
        warmup: d.warmup.map((w, x) => (x === i ? { ...w, ...patch } : w)),
      })),
    [mapDay],
  );

  const addExercise = useCallback(
    (dayIndex: number, exerciseId: string) =>
      mapDay(dayIndex, (d) =>
        // 同一天里不重复放同一个动作
        d.exercises.some((e) => e.exerciseId === exerciseId)
          ? d
          : { ...d, exercises: [...d.exercises, { exerciseId, sets: 3, repRange: [8, 12] }] },
      ),
    [mapDay],
  );

  const removeExercise = useCallback(
    (dayIndex: number, i: number) =>
      mapDay(dayIndex, (d) => ({ ...d, exercises: d.exercises.filter((_, x) => x !== i) })),
    [mapDay],
  );

  const moveExercise = useCallback(
    (dayIndex: number, i: number, dir: -1 | 1) =>
      mapDay(dayIndex, (d) => {
        const j = i + dir;
        if (j < 0 || j >= d.exercises.length) return d;
        const next = [...d.exercises];
        [next[i], next[j]] = [next[j], next[i]];
        return { ...d, exercises: next };
      }),
    [mapDay],
  );

  const setExerciseSets = useCallback(
    (dayIndex: number, i: number, sets: number) =>
      mapDay(dayIndex, (d) => ({
        ...d,
        exercises: d.exercises.map((e, x) => (x === i ? { ...e, sets } : e)),
      })),
    [mapDay],
  );

  const setExerciseRepRange = useCallback(
    (dayIndex: number, i: number, repRange: [number, number]) =>
      mapDay(dayIndex, (d) => ({
        ...d,
        exercises: d.exercises.map((e, x) => (x === i ? { ...e, repRange } : e)),
      })),
    [mapDay],
  );

  /**
   * 导入备份里的计划。按 id 去重、只增不改 —— 和训练记录同一条原则：
   * 导入永远不该覆盖或弄丢现有的东西。
   * 顺带处理「备份里的当前计划」：只有它确实存在（或这次刚导进来）才切过去。
   */
  const importPrograms = useCallback(
    (incoming: Program[], preferActiveId: string | null): { added: number; activated: boolean } => {
      const existing = new Set(state.programs.map((p) => p.id));
      const toAdd = incoming.filter(
        (p) => p && typeof p.id === 'string' && Array.isArray(p.days) && !existing.has(p.id),
      );
      const willExist = new Set([...existing, ...toAdd.map((p) => p.id)]);
      const activate = preferActiveId && willExist.has(preferActiveId) ? preferActiveId : null;

      if (toAdd.length || activate) {
        setState((s) => ({
          programs: [...s.programs, ...toAdd.filter((p) => !s.programs.some((x) => x.id === p.id))],
          activeProgramId: activate ?? s.activeProgramId ?? toAdd[0]?.id ?? null,
        }));
      }
      return { added: toAdd.length, activated: activate !== null };
    },
    [state.programs],
  );

  return {
    programs: state.programs,
    program,
    createFromTemplate,
    createBlank,
    setActive,
    rename,
    remove,
    resetFromTemplate,
    importPrograms,
    setProgramName,
    setProgramDesc,
    addDay,
    removeDay,
    setDayName,
    setDayFocus,
    moveDay,
    addWarmup,
    addWarmupFromLibrary,
    removeWarmup,
    moveWarmup,
    setWarmup,
    addExercise,
    removeExercise,
    moveExercise,
    setExerciseSets,
    setExerciseRepRange,
  };
}

export type ProgramStore = ReturnType<typeof usePrograms>;

/** 内置模板列表，供「新建计划」选起点 */
export const TEMPLATES = PROGRAMS;
