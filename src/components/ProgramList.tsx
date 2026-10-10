import { useState } from 'react';
import { PROGRAMS } from '../lib/programs';
import type { ProgramStore } from '../lib/usePrograms';

interface Props {
  store: ProgramStore;
  /** 一个计划都没有时，这是「开始」界面；有计划时，这是管理界面 */
  empty: boolean;
  onClose: () => void;
}

export function ProgramList({ store, empty, onClose }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);

  return (
    <section className="program">
      <header className="program-head">
        <h2 className="history-title">{empty ? '选一个起点' : '我的计划'}</h2>
        {!empty && (
          <button className="btn-text" onClick={onClose}>
            返回
          </button>
        )}
      </header>

      {empty && (
        <p className="hint">
          模板是<strong>只读的起点</strong>：选用后它会被复制成归你所有的一份，之后你随便改，
          模板怎么更新都影响不到它。
        </p>
      )}

      {!empty && store.programs.length > 0 && (
        <div className="program-rows">
          {store.programs.map((p) => {
            const active = p.id === store.program?.id;
            return (
              <div className={`program-row ${active ? 'program-row-on' : ''}`} key={p.id}>
                {renaming === p.id ? (
                  <input
                    className="editor-name"
                    autoFocus
                    defaultValue={p.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v) store.rename(p.id, v);
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <button className="program-row-name" onClick={() => store.setActive(p.id)}>
                    {p.name}
                    {active && <span className="program-row-active">当前</span>}
                  </button>
                )}
                <span className="program-row-meta">
                  {p.days.length} 个训练日 · {p.days.reduce((n, d) => n + d.exercises.length, 0)} 个动作
                </span>
                <div className="program-row-actions">
                  <button onClick={() => setRenaming(p.id)} title="重命名">
                    重命名
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`删除计划「${p.name}」？训练历史不受影响，但计划本身无法恢复。`)) {
                        store.remove(p.id);
                      }
                    }}
                    title="删除"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="program-subtitle">{empty ? '从模板开始' : '从模板新建一份'}</h3>
      <div className="program-cards">
        {PROGRAMS.map((tpl) => (
          <button
            key={tpl.id}
            className="program-card"
            onClick={() => {
              store.createFromTemplate(tpl.id);
              onClose();
            }}
          >
            <strong>{tpl.name}</strong>
            <span className="program-card-desc">{tpl.desc}</span>
            <span className="program-card-meta">
              {tpl.days.length} 个训练日 · {tpl.days.map((d) => d.name).join(' / ')}
            </span>
          </button>
        ))}
      </div>

      <button
        className="btn-add-ex program-blank"
        onClick={() => {
          store.createBlank();
          onClose();
        }}
      >
        + 从空白新建（自己排）
      </button>
    </section>
  );
}
