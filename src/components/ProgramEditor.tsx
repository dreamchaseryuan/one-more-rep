import { useState } from 'react';
import type { Dataset } from '../lib/data';
import type { Program } from '../lib/programs';
import type { ProgramStore } from '../lib/usePrograms';
import { ExercisePicker } from './ExercisePicker';

interface Props {
  dataset: Dataset;
  program: Program;
  store: ProgramStore;
  onDone: () => void;
}

/** 数字输入：允许暂时空着，只在拿到合法值时写回 */
function NumInput({
  value,
  onChange,
  min = 1,
  max = 99,
  width,
  title,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  width?: number;
  title?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  return (
    <input
      className="num-input"
      style={width ? { width } : undefined}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      title={title}
      value={shown}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = Number(raw);
        if (raw !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function ProgramEditor({ dataset, program, store, onDone }: Props) {
  // 正在为哪个训练日挑动作
  const [pickFor, setPickFor] = useState<number | null>(null);

  return (
    <section className="program editor">
      <header className="program-head">
        <div className="editor-title">
          <input
            className="editor-name"
            value={program.name}
            onChange={(e) => store.setProgramName(e.target.value)}
            placeholder="计划名称"
          />
          <input
            className="editor-desc"
            value={program.desc ?? ''}
            onChange={(e) => store.setProgramDesc(e.target.value)}
            placeholder="一句话说明（可留空）"
          />
        </div>
        <button className="btn-primary" onClick={onDone}>
          完成
        </button>
      </header>

      <p className="hint editor-hint">
        改动立即保存。历史记录不受影响——每次训练都存了当时计划的快照。
        {program.fromTemplate && (
          <>
            {' '}
            这份计划派生自模板，已与模板脱钩。
            <button
              className="btn-text editor-reset"
              onClick={() => {
                if (confirm(`把「${program.name}」的内容换回模板的初始状态？你对它的编辑会丢失。`)) {
                  store.resetFromTemplate(program.id);
                }
              }}
            >
              恢复模板初始状态
            </button>
          </>
        )}
      </p>

      {program.days.map((day, di) => (
        <article className="editor-day" key={di}>
          <div className="editor-day-head">
            <input
              className="editor-day-name"
              value={day.name}
              onChange={(e) => store.setDayName(di, e.target.value)}
              placeholder="训练日名称"
            />
            <input
              className="editor-day-focus"
              value={day.focus}
              onChange={(e) => store.setDayFocus(di, e.target.value)}
              placeholder="练哪里（可留空）"
            />
            <div className="editor-day-actions">
              <button onClick={() => store.moveDay(di, -1)} disabled={di === 0} title="上移">
                ↑
              </button>
              <button
                onClick={() => store.moveDay(di, 1)}
                disabled={di === program.days.length - 1}
                title="下移"
              >
                ↓
              </button>
              <button
                onClick={() => store.removeDay(di)}
                disabled={program.days.length <= 1}
                title={program.days.length <= 1 ? '至少要留一个训练日' : '删除这个训练日'}
              >
                ✕
              </button>
            </div>
          </div>

          {day.exercises.length === 0 && <p className="hint">这个训练日还没有动作。</p>}

          {day.exercises.map((ex, ei) => {
            const info = dataset.byId.get(ex.exerciseId);
            return (
              <div className="editor-ex" key={ex.exerciseId}>
                <span className="editor-ex-name">
                  {info?.nameZh ?? ex.exerciseId}
                  {!info && <span className="editor-ex-gone">动作已不在库中</span>}
                </span>

                <label className="editor-field">
                  组数
                  <NumInput value={ex.sets} onChange={(n) => store.setExerciseSets(di, ei, n)} />
                </label>

                <label className="editor-field">
                  次数
                  <NumInput
                    value={ex.repRange[0]}
                    onChange={(n) => store.setExerciseRepRange(di, ei, [n, Math.max(n, ex.repRange[1])])}
                  />
                  <span className="editor-tilde">~</span>
                  <NumInput
                    value={ex.repRange[1]}
                    onChange={(n) => store.setExerciseRepRange(di, ei, [Math.min(n, ex.repRange[0]), n])}
                  />
                </label>

                <div className="editor-ex-actions">
                  <button onClick={() => store.moveExercise(di, ei, -1)} disabled={ei === 0} title="上移">
                    ↑
                  </button>
                  <button
                    onClick={() => store.moveExercise(di, ei, 1)}
                    disabled={ei === day.exercises.length - 1}
                    title="下移"
                  >
                    ↓
                  </button>
                  <button onClick={() => store.removeExercise(di, ei)} title="移除">
                    ✕
                  </button>
                </div>
              </div>
            );
          })}

          <button className="btn-add-ex editor-add" onClick={() => setPickFor(di)}>
            + 添加动作
          </button>
        </article>
      ))}

      <button className="btn-add-ex" onClick={store.addDay}>
        + 添加训练日
      </button>

      {pickFor !== null && (
        <ExercisePicker
          dataset={dataset}
          added={new Set(program.days[pickFor]?.exercises.map((e) => e.exerciseId) ?? [])}
          onPick={(id) => {
            store.addExercise(pickFor, id);
            // 不关闭：连续加几个动作是常见操作
          }}
          onClose={() => setPickFor(null)}
        />
      )}
    </section>
  );
}
