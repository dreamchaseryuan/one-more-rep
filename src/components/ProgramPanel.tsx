import { useEffect, useState } from 'react';
import type { Dataset } from '../lib/data';
import {
  buildDaySnapshot,
  lastProgramDay,
  nextDayIndex,
  planDay,
  repRangeText,
} from '../lib/programs';
import type { ProgramStore } from '../lib/usePrograms';
import type { WorkoutStore } from '../lib/useWorkouts';
import type { ContraindicationStore } from '../lib/useContraindications';
import type { IndexedExercise, LoggedExercise, WorkoutDaySnapshot } from '../types';
import { ProgramList } from './ProgramList';
import { ProgramEditor } from './ProgramEditor';

interface Props {
  dataset: Dataset;
  store: WorkoutStore;
  programStore: ProgramStore;
  contraStore: ContraindicationStore;
  onOpenExercise: (e: IndexedExercise) => void;
  onStartDay: (entries: LoggedExercise[], day: WorkoutDaySnapshot) => void;
}

const fmtLast = (sets: { weight: string; reps: string }[]) =>
  sets.map((s) => (s.weight ? `${s.weight}×${s.reps}` : `${s.reps}次`)).join('，');

export function ProgramPanel({
  dataset,
  store,
  programStore,
  contraStore,
  onOpenExercise,
  onStartDay,
}: Props) {
  const { program } = programStore;
  const [manual, setManual] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  /** 这次训练里被「仍要练」覆盖掉的禁忌。只对当前这次有效，不改禁忌标记。 */
  const [overrides, setOverrides] = useState<Set<string>>(new Set());

  // 轮转位置从训练历史推导，不存状态 —— 见 usePrograms.ts 的说明
  const derived = program ? nextDayIndex(program, lastProgramDay(store.workouts, program.id)) : 0;

  // 练完一次（派生值随之变化）就丢掉手动选择，回到建议值
  useEffect(() => setManual(null), [derived]);

  // 计划被删光或换了，退出编辑态
  useEffect(() => {
    if (!program) {
      setEditing(false);
      setManaging(false);
    }
  }, [program]);

  if (!program || managing) {
    return (
      <ProgramList
        store={programStore}
        empty={!program}
        onClose={() => setManaging(false)}
      />
    );
  }

  if (editing) {
    return (
      <ProgramEditor
        dataset={dataset}
        program={program}
        store={programStore}
        onDone={() => setEditing(false)}
      />
    );
  }

  // 计划可能还没有任何训练日（从空白新建后被删到只剩一天不成立，但防御一下）
  const dayIndex = Math.min(manual ?? derived, program.days.length - 1);
  const day = program.days[dayIndex];
  if (!day) {
    return (
      <section className="program">
        <p className="hint">这个计划没有训练日。</p>
        <button className="btn-primary" onClick={() => setEditing(true)}>
          去编辑
        </button>
      </section>
    );
  }

  // 加重建议只看同一计划下的成绩：不同计划的训练意图不同，成绩不可比
  const planned = planDay(day, dataset.byId, (id) => store.lastPerformance(id, program.id));

  // 伤病禁忌挡掉的动作，这次不练；除非当场点了「仍要练」
  const isBlocked = (id: string) => contraStore.blocked(id) && !overrides.has(id);
  const usable = planned.filter((p) => !isBlocked(p.exerciseId));

  const start = () =>
    onStartDay(
      usable.map((p) => ({ exerciseId: p.exerciseId, sets: p.presetSets })),
      buildDaySnapshot(program, dayIndex, dataset.byId, (id) => !isBlocked(id)),
    );

  return (
    <section className="program">
      <header className="program-head">
        <div>
          <h2 className="history-title">{program.name}</h2>
          {program.cadence && <p className="hint">{program.cadence}</p>}
        </div>
        <div className="program-head-actions">
          <button className="btn-text" onClick={() => setEditing(true)}>
            编辑
          </button>
          <button className="btn-text" onClick={() => setManaging(true)}>
            我的计划
          </button>
        </div>
      </header>

      <div className="day-tabs">
        {program.days.map((d, i) => (
          <button
            key={`${d.name}-${i}`}
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
          {day.focus && <span className="hint">{day.focus}</span>}
        </div>

        {planned.length === 0 && <p className="hint">这个训练日还没有动作。点「编辑」加几个。</p>}

        {planned.map((p) => {
          const last = store.lastPerformance(p.exerciseId, program.id);
          const elsewhere = last ? null : store.lastPerformanceAnyScope(p.exerciseId);
          const contra = contraStore.get(p.exerciseId);
          const blocked = isBlocked(p.exerciseId);
          return (
            <div className={`plan-ex ${blocked ? 'plan-ex-blocked' : ''}`} key={p.exerciseId}>
              <div className="plan-ex-main">
                <button
                  className="plan-ex-name"
                  onClick={() => p.exercise && onOpenExercise(p.exercise)}
                >
                  {p.exercise?.nameZh ?? '(动作已不在库中)'}
                </button>
                <span className="plan-ex-scheme">
                  {p.sets} 组 × {repRangeText(p.repRange)}
                </span>
                {blocked ? (
                  <span className="plan-ex-contra">
                    伤病禁忌
                    {contra?.note ? ` · ${contra.note}` : ''}
                    <button
                      className="plan-ex-override"
                      onClick={() => setOverrides((prev) => new Set(prev).add(p.exerciseId))}
                      title="今天感觉可以，照常练"
                    >
                      仍要练
                    </button>
                  </span>
                ) : (
                  <span className={`plan-ex-suggest suggest-${p.suggestion.kind}`}>
                    {p.suggestion.text}
                  </span>
                )}
              </div>
              {!blocked && (
                <div className="plan-ex-last">
                  {last
                    ? `上次 ${last.date.slice(5)}：${fmtLast(last.sets)}`
                    : elsewhere
                      ? `本计划下还没练过（其他记录最近 ${elsewhere.date.slice(5)}：${fmtLast(elsewhere.sets)}）`
                      : '还没有记录'}
                </div>
              )}
            </div>
          );
        })}

        {planned.length > 0 && usable.length === 0 && (
          <p className="plan-warn">
            这个训练日的动作<strong>全部</strong>被伤病禁忌挡掉了。先去解除禁忌，或者换个训练日。
          </p>
        )}
        {usable.length === 1 && planned.length > 1 && (
          <p className="plan-warn">
            今天只剩 <strong>1</strong> 个动作可练，练下来会缺一大块。建议换个训练日。
          </p>
        )}

        {usable.length > 0 && (
          <>
            <button className="btn-primary btn-block plan-start" onClick={start}>
              开始{day.name}（{usable.length} 个动作，自动填入建议重量）
            </button>
            <p className="hint">
              练完结束训练后，会自动轮到这个计划的下一个训练日。
              {store.current && store.current.entries.length > 0 && (
                <strong> 注意：当前已有进行中的训练，同名动作会被计划里的覆盖。</strong>
              )}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
