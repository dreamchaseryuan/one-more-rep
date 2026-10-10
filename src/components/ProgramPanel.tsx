import { useEffect, useState } from 'react';
import type { Dataset } from '../lib/data';
import {
  buildDaySnapshot,
  lastProgramDay,
  nextDayIndex,
  planDay,
  PROGRAMS,
  repRangeText,
} from '../lib/programs';
import type { ProgramStore } from '../lib/useProgram';
import type { WorkoutStore } from '../lib/useWorkouts';
import type { IndexedExercise, LoggedExercise, WorkoutDaySnapshot } from '../types';

interface Props {
  dataset: Dataset;
  store: WorkoutStore;
  programStore: ProgramStore;
  onOpenExercise: (e: IndexedExercise) => void;
  onStartDay: (entries: LoggedExercise[], day: WorkoutDaySnapshot) => void;
}

const fmtLast = (sets: { weight: string; reps: string }[]) =>
  sets.map((s) => (s.weight ? `${s.weight}×${s.reps}` : `${s.reps}次`)).join('，');

export function ProgramPanel({ dataset, store, programStore, onOpenExercise, onStartDay }: Props) {
  const { program, select, clear } = programStore;
  const [manual, setManual] = useState<number | null>(null);

  // 轮转位置从训练历史推导，不存状态 —— 见 useProgram.ts 的说明
  const derived = program ? nextDayIndex(program, lastProgramDay(store.workouts, program.id)) : 0;

  // 练完一次（派生值随之变化）就丢掉手动选择，回到建议值
  useEffect(() => setManual(null), [derived]);

  if (!program) {
    return (
      <section className="program">
        <h2 className="history-title">选一个训练计划</h2>
        <p className="hint">
          计划决定今天练哪些动作、几组、每组几次，并根据上次成绩告诉你该上多少重量。
          之后可以随时换。
        </p>
        <div className="program-cards">
          {PROGRAMS.map((p) => (
            <button key={p.id} className="program-card" onClick={() => select(p.id)}>
              <strong>{p.name}</strong>
              <span className="program-card-desc">{p.desc}</span>
              <span className="program-card-meta">
                {p.days.length} 个训练日 · {p.days.map((d) => d.name).join(' / ')}
              </span>
              <span className="program-card-cadence">{p.cadence}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const dayIndex = manual ?? derived;
  const day = program.days[dayIndex];
  // 加重建议只看同一计划下的成绩：不同计划的训练意图不同，成绩不可比
  const planned = planDay(day, dataset.byId, (id) => store.lastPerformance(id, program.id));
  const start = () =>
    onStartDay(
      planned.map((p) => ({ exerciseId: p.exerciseId, sets: p.presetSets })),
      buildDaySnapshot(program, dayIndex, dataset.byId),
    );

  return (
    <section className="program">
      <header className="program-head">
        <div>
          <h2 className="history-title">{program.name}</h2>
          <p className="hint">{program.cadence}</p>
        </div>
        <div className="program-head-actions">
          <button className="btn-text" onClick={clear}>
            换计划
          </button>
        </div>
      </header>

      <div className="day-tabs">
        {program.days.map((d, i) => (
          <button
            key={d.name}
            className={`day-tab ${i === dayIndex ? 'day-tab-on' : ''}`}
            onClick={() => setManual(i)}
          >
            {d.name}
            {i === derived && <span className="day-tab-hint">建议</span>}
          </button>
        ))}
      </div>

      <div className="plan-day">
        <div className="plan-day-head">
          <strong>{day.name}</strong>
          <span className="hint">{day.focus}</span>
        </div>

        {planned.map((p) => {
          const last = store.lastPerformance(p.exerciseId, program.id);
          const elsewhere = last ? null : store.lastPerformanceAnyScope(p.exerciseId);
          return (
            <div className="plan-ex" key={p.exerciseId}>
              <div className="plan-ex-main">
                <button
                  className="plan-ex-name"
                  onClick={() => p.exercise && onOpenExercise(p.exercise)}
                >
                  {p.exercise?.nameZh ?? '(动作已下架)'}
                </button>
                <span className="plan-ex-scheme">
                  {p.sets} 组 × {repRangeText(p.repRange)}
                </span>
                <span className={`plan-ex-suggest suggest-${p.suggestion.kind}`}>
                  {p.suggestion.text}
                </span>
              </div>
              <div className="plan-ex-last">
                {last
                  ? `上次 ${last.date.slice(5)}：${fmtLast(last.sets)}`
                  : elsewhere
                    ? `本计划下还没练过（其他记录最近 ${elsewhere.date.slice(5)}：${fmtLast(elsewhere.sets)}）`
                    : '还没有记录'}
              </div>
            </div>
          );
        })}

        <button className="btn-primary btn-block plan-start" onClick={start}>
          开始{day.name}（自动填入建议重量）
        </button>
        <p className="hint">
          练完结束训练后，会自动轮到这个计划的下一个训练日。
          {store.current && store.current.entries.length > 0 && (
            <strong> 注意：当前已有进行中的训练，同名动作会被计划里的覆盖。</strong>
          )}
        </p>
      </div>
    </section>
  );
}
