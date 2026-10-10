import { useRef, useState } from 'react';
import type { Dataset } from '../lib/data';
import type { WorkoutStore } from '../lib/useWorkouts';
import { filledSetCount, workoutVolume } from '../lib/useWorkouts';
import { buildBackup, downloadBackup, parseBackup } from '../lib/backup';
import { repRangeText } from '../lib/programs';
import type { IndexedExercise, SetEntry } from '../types';
import { ExercisePicker } from './ExercisePicker';
import { RestTimer } from './RestTimer';
import { ProgressChart } from './ProgressChart';

interface Props {
  dataset: Dataset;
  store: WorkoutStore;
  onOpenExercise: (e: IndexedExercise) => void;
  favorites: Set<string>;
  onMergeFavorites: (ids: string[]) => void;
  /** 当前计划的 id，备份要带上它 */
  programId: string | null;
  /** 从备份里恢复出了计划选择时通知外层 */
  onProgramRestored: (programId: string) => void;
}

/** 把一组压缩成 "60×8" 这种紧凑写法 */
const fmtSet = (s: SetEntry) => (s.weight ? `${s.weight}×${s.reps || '?'}` : `${s.reps || '?'} 次`);

const fmtSets = (sets: SetEntry[]) => sets.map(fmtSet).join('，');

export function WorkoutPanel({
  dataset,
  store,
  onOpenExercise,
  favorites,
  onMergeFavorites,
  programId,
  onProgramRestored,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resting, setResting] = useState(false);
  const [restRun, setRestRun] = useState(0);
  const [restDuration, setRestDuration] = useState(90);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { current, history } = store;

  const handleExport = () => {
    downloadBackup(buildBackup(store.workouts, [...favorites], programId));
    setImportMsg(null);
  };

  const handleImport = async (file: File) => {
    const { backup, error, skipped, fromVersion } = parseBackup(await file.text());
    if (error || !backup) {
      setImportMsg(`导入失败：${error}`);
      return;
    }
    const added = store.importWorkouts(backup.workouts);
    onMergeFavorites(backup.favorites);
    if (backup.programId) onProgramRestored(backup.programId);

    const dup = backup.workouts.length - added;
    setImportMsg(
      `导入完成：新增 ${added} 次训练` +
        (dup > 0 ? `，${dup} 条已存在（跳过）` : '') +
        (skipped > 0 ? `，${skipped} 条格式不对（跳过）` : '') +
        // v1 备份没有计划字段和训练日快照，历史里那些记录会显示成「自由训练」
        (fromVersion < 2 ? '。这是旧版备份：其中的训练不会关联到计划' : ''),
    );
  };

  const nameOf = (id: string) => dataset.byId.get(id)?.nameZh ?? '(已删除的动作)';
  const exOf = (id: string) => dataset.byId.get(id);

  const addAndClose = (id: string) => {
    store.addExercise(id);
    setPickerOpen(false);
  };

  const toggleDone = (exerciseId: string, index: number, done: boolean) => {
    store.updateSet(exerciseId, index, { done });
    if (done) {
      setResting(true);
      setRestRun((n) => n + 1);
    }
  };

  return (
    <div className="workout">
      {current ? (
        <section className="today">
          <header className="today-head">
            <div>
              <h2>
                今日训练
                {current.day && (
                  <span className="today-day">
                    {current.day.programName} · {current.day.dayName}
                  </span>
                )}
              </h2>
              <p className="today-sub">
                {current.date} · {current.entries.length} 个动作 · 总容量{' '}
                {Math.round(workoutVolume(current))} kg
              </p>
            </div>
            <div className="today-actions">
              <button
                className="btn-primary"
                onClick={store.finish}
                disabled={filledSetCount(current) === 0}
                title={filledSetCount(current) === 0 ? '先打勾至少一组，或填上重量' : undefined}
              >
                结束训练
              </button>
              <button className="btn-text" onClick={store.discard}>
                放弃
              </button>
            </div>
          </header>

          {current.entries.length === 0 && (
            <p className="hint">还没有动作。点下面的「添加动作」开始。</p>
          )}

          {current.entries.map((entry) => {
            const ex = exOf(entry.exerciseId);
            // 「上次」限定在这次训练所属的计划内 —— 自由训练传 null
            const last = store.lastPerformance(entry.exerciseId, current.day?.programId ?? null);
            const best = store.bestSet(entry.exerciseId);
            return (
              <article className="ex-block" key={entry.exerciseId}>
                <div className="ex-head">
                  <button className="ex-name" onClick={() => ex && onOpenExercise(ex)}>
                    {nameOf(entry.exerciseId)}
                  </button>
                  <button
                    className="ex-del"
                    title="从今天移除"
                    onClick={() => store.removeExercise(entry.exerciseId)}
                  >
                    ✕
                  </button>
                </div>

                <div className="ex-refs">
                  {last ? (
                    <span>
                      上次 {last.date.slice(5)}：<b>{fmtSets(last.sets)}</b>
                    </span>
                  ) : (
                    <span className="hint">第一次练这个动作</span>
                  )}
                  {best && Number(best.weight) > 0 && (
                    <span className="hint">最佳 {best.weight}kg×{best.reps}</span>
                  )}
                </div>

                <table className="sets">
                  <thead>
                    <tr>
                      <th>组</th>
                      <th>重量 (kg)</th>
                      <th>次数</th>
                      <th>完成</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {entry.sets.map((s, i) => (
                      <tr key={i} className={s.done ? 'set-done' : ''}>
                        <td className="set-idx">{i + 1}</td>
                        <td>
                          <input
                            className="set-input"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            value={s.weight}
                            placeholder="—"
                            onChange={(e) =>
                              store.updateSet(entry.exerciseId, i, { weight: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="set-input"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={s.reps}
                            placeholder="—"
                            onChange={(e) =>
                              store.updateSet(entry.exerciseId, i, { reps: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <button
                            className={`set-check ${s.done ? 'on' : ''}`}
                            onClick={() => toggleDone(entry.exerciseId, i, !s.done)}
                            title={s.done ? '取消完成' : '完成本组'}
                          >
                            ✓
                          </button>
                        </td>
                        <td>
                          <button
                            className="set-del"
                            onClick={() => store.removeSet(entry.exerciseId, i)}
                            disabled={entry.sets.length <= 1}
                            title="删掉这组"
                          >
                            −
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button className="btn-add-set" onClick={() => store.addSet(entry.exerciseId)}>
                  + 加一组
                </button>
              </article>
            );
          })}

          <button className="btn-add-ex" onClick={() => setPickerOpen(true)}>
            + 添加动作
          </button>
        </section>
      ) : (
        <section className="start-card">
          <h2>开始今天的训练</h2>
          <p className="hint">
            记录组数、重量、次数。下次练同一个动作会<strong>自动带出上次的数据</strong>，方便加重量。
          </p>
          <button className="btn-primary btn-lg" onClick={store.start}>
            开始训练
          </button>
        </section>
      )}

      {history.length > 0 && (
        <section className="history">
          <h2 className="history-title">训练历史（{history.length} 次）</h2>
          {history.map((w) => {
            const open = expanded === w.id;
            return (
              <div className="hist-item" key={w.id}>
                <button
                  className="hist-head"
                  onClick={() => setExpanded(open ? null : w.id)}
                >
                  <span className="hist-date">{w.date}</span>
                  <span className="hist-day">
                    {w.day ? w.day.dayName : '自由训练'}
                  </span>
                  <span className="hist-sum">
                    {w.entries.length} 个动作 · {Math.round(workoutVolume(w))} kg
                  </span>
                  <span className="hist-toggle">{open ? '收起' : '展开'}</span>
                </button>

                {open && (
                  <div className="hist-body">
                    {w.entries.map((e) => {
                      const snap = w.day?.exercises.find((s) => s.exerciseId === e.exerciseId);
                      // 快照里有当时的动作中文名 —— 动作从库里下架后历史仍读得懂
                      const name = snap?.nameZh ?? nameOf(e.exerciseId);
                      return (
                        <div className="hist-ex" key={e.exerciseId}>
                          <span className="hist-ex-name">
                            {name}
                            {w.day && !snap && <span className="hist-extra">计划外</span>}
                          </span>
                          <span className="hist-ex-sets">{fmtSets(e.sets)}</span>
                          {snap && (
                            <span className="hist-plan">
                              计划 {snap.sets} 组 × {repRangeText(snap.repRange)}
                              {e.sets.length !== snap.sets && (
                                <em className="hist-deviation"> · 实际做了 {e.sets.length} 组</em>
                              )}
                            </span>
                          )}
                          <ProgressChart points={store.weightHistory(e.exerciseId)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="backup">
        <h2 className="history-title">数据备份</h2>
        <p className="hint">
          训练记录只存在这台设备的浏览器里，<strong>不会上传到任何服务器</strong>。
          清缓存或换设备就没了，建议定期导出。
          目前 {store.workouts.length} 次训练、{favorites.size} 个收藏。
        </p>
        <div className="backup-actions">
          <button className="btn-primary" onClick={handleExport} disabled={!store.workouts.length}>
            导出备份
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            导入备份
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.target.value = ''; // 允许连续导入同一个文件
            }}
          />
        </div>
        {importMsg && <p className={`backup-msg ${importMsg.startsWith('导入失败') ? 'bad' : 'good'}`}>{importMsg}</p>}
      </section>

      {pickerOpen && (
        <ExercisePicker
          dataset={dataset}
          added={new Set(current?.entries.map((e) => e.exerciseId) ?? [])}
          onPick={addAndClose}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {resting && current && (
        <RestTimer
          runId={restRun}
          duration={restDuration}
          onDurationChange={setRestDuration}
          onDismiss={() => setResting(false)}
        />
      )}
    </div>
  );
}
