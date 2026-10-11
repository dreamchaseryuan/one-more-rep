import { useEffect, useState } from 'react';
import type { Dataset } from '../lib/data';
import {
  buildDaySnapshot,
  lastProgramDay,
  nextDayIndex,
  planDay,
  rampText,
  rampUpSets,
  repRangeText,
} from '../lib/programs';
import type { ProgramStore } from '../lib/usePrograms';
import type { WorkoutStore } from '../lib/useWorkouts';
import type { ContraindicationStore } from '../lib/useContraindications';
import type { IndexedExercise, LoggedExercise, WorkoutDaySnapshot } from '../types';
import { ProgramList } from './ProgramList';
import { ProgramEditor } from './ProgramEditor';
import { WarmupList } from './WarmupList';

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

  // 递增组只给第一个有建议重量的动作 —— 全身热身做一次就够，不是每个动作都重来一遍
  const rampFor = usable.find((p) => p.suggestion.weight !== null)?.exerciseId ?? null;
  const ramp = rampUpSets(usable.find((p) => p.exerciseId === rampFor)?.suggestion.weight ?? null);

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

        {/*
          热身折起来。它原本占 161px，是这一页最大的单块 —— 但你不会在计划页上照着做热身，
          你是在训练中照着做。所以真正的清单放到训练中界面（见 WorkoutPanel），
          这里收成一行，想看细节点一下就行（`<details>` 原生行为，不用额外的 state）。
        */}
        {day.warmup.length > 0 && (
          <details className="warmup warmup-fold">
            <summary className="warmup-summary">热身 · {day.warmup.length} 项</summary>
            <WarmupList items={day.warmup} byId={dataset.byId} onOpenExercise={onOpenExercise} />
          </details>
        )}

        {planned.length === 0 && <p className="hint">这个训练日还没有动作。点「编辑」加几个。</p>}

        {/* 两列：这个面板有 1240px 宽，只放一列的话一行会横跨 1200px，
            名称在最左、建议在最右，中间一大片空。 */}
        <div className="plan-ex-list">
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

                  {/*
                    没有历史记录时，上次成绩就并到这一行里。
                    有记录时不并 —— 那时候建议那行本来就带着成绩（「上次 60kg 做满 8 次 → …」），
                    再写一遍是冗余。
                  */}
                  {!blocked && !last && (
                    <span className="plan-ex-last">
                      {elsewhere
                        ? `本计划下还没练过 · 其他记录最近 ${elsewhere.date.slice(5)}：${fmtLast(elsewhere.sets)}`
                        : '还没记录'}
                    </span>
                  )}
                </div>

                {blocked ? (
                  <div className="plan-ex-contra">
                    伤病禁忌
                    {contra?.note ? ` · ${contra.note}` : ''}
                    <button
                      className="plan-ex-override"
                      onClick={() => setOverrides((prev) => new Set(prev).add(p.exerciseId))}
                      title="今天感觉可以，照常练"
                    >
                      仍要练
                    </button>
                  </div>
                ) : (
                  /*
                    **建议只在有历史记录时才单独占一行。**
                    第一次练时它算出来的是「选个能做满 X 次的重量」—— 一句占位话，
                    6 个动作里重复 6 遍只差数字，却装在胶囊里、是整行最抢眼的东西。
                    实测这一行让每个动作占 93px，手机上 6 个动作就是 556px，
                    是整块计划里最大的一坨（热身才 161px）。
                  */
                  last && (
                    <div className={`plan-ex-suggest suggest-${p.suggestion.kind}`}>
                      {p.suggestion.text}
                    </div>
                  )
                )}

                {!blocked && p.exerciseId === rampFor && ramp.length > 0 && (
                  <div className="ramp">
                    递增组：{rampText(ramp)} kg —— 不记录，只为让重量和轨迹先走一遍
                  </div>
                )}
              </div>
            );
          })}
        </div>

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
