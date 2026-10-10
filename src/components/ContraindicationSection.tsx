import { useMemo, useState } from 'react';
import type { Dataset } from '../lib/data';
import { isExpired, type ContraindicationStore } from '../lib/useContraindications';

interface Props {
  dataset: Dataset;
  store: ContraindicationStore;
  /** 点动作名时打开详情 */
  onOpenExercise: (id: string) => void;
}

export function ContraindicationSection({ dataset, store, onOpenExercise }: Props) {
  const [batching, setBatching] = useState(false);
  const [part, setPart] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const expired = store.items.filter((c) => isExpired(c));

  const candidates = useMemo(() => {
    if (!dataset) return [];
    const q = query.trim().toLowerCase();
    return dataset.exercises
      .filter((e) => (!part || e.bodyPart === part) && (!q || e.haystack.includes(q)))
      .slice(0, 60);
  }, [dataset, part, query]);

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="contra">
      <header className="contra-head">
        <h2 className="history-title">伤病禁忌（{store.items.length}）</h2>
        <button className="btn-text" onClick={() => setBatching((v) => !v)}>
          {batching ? '取消' : '按部位批量添加'}
        </button>
      </header>

      <p className="hint">
        被标记的动作不会出现在计划安排里，但<strong>在动作库中仍然搜得到</strong>——它不是删除动作。
        标记只是提醒，想练的时候可以当场覆盖。
      </p>

      {expired.length > 0 && (
        <div className="contra-expired">
          <strong>有 {expired.length} 个动作的禁忌已过预计恢复日，还在疼吗？</strong>
          <span className="hint">
            到期不会自动解除——否则会在你没注意的时候把受伤动作塞回计划。
          </span>
          <div className="contra-expired-actions">
            <button className="btn-text" onClick={() => expired.forEach((c) => store.unmark(c.exerciseId))}>
              都不疼了，全部解除
            </button>
          </div>
        </div>
      )}

      {batching && (
        <div className="contra-batch">
          <div className="chips">
            <button className={`chip ${!part ? 'chip-on' : ''}`} onClick={() => setPart(null)}>
              全部部位
            </button>
            {dataset.options.bodyPart.map((o) => (
              <button
                key={o.value}
                className={`chip ${part === o.value ? 'chip-on' : ''}`}
                onClick={() => setPart(o.value)}
              >
                {o.label}
                <span className="chip-count">{o.count}</span>
              </button>
            ))}
          </div>

          <input
            className="search contra-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="在候选里再筛一下…"
          />

          <p className="hint">
            自己勾要避开哪些。不自动推荐替代动作——猜错了比不给更糟，你会信它。
          </p>

          <div className="contra-candidates">
            {candidates.map((e) => {
              const already = store.blocked(e.id);
              return (
                <label className={`contra-cand ${already ? 'contra-cand-on' : ''}`} key={e.id}>
                  <input
                    type="checkbox"
                    checked={picked.has(e.id) || already}
                    disabled={already}
                    onChange={() => togglePick(e.id)}
                  />
                  <span className="contra-cand-name">{e.nameZh}</span>
                  <span className="contra-cand-meta">
                    {e.targetZh} · {e.equipmentZh}
                  </span>
                </label>
              );
            })}
            {candidates.length === 0 && <p className="hint">没有匹配的动作。</p>}
          </div>

          <div className="contra-batch-actions">
            <input
              className="contra-note"
              placeholder="备注（可留空，例：右肩冈上肌）"
              id="contra-batch-note"
            />
            <button
              className="btn-primary"
              disabled={picked.size === 0}
              onClick={() => {
                const note = (document.getElementById('contra-batch-note') as HTMLInputElement)?.value.trim();
                store.markMany([...picked], note ? { note } : {});
                setPicked(new Set());
              }}
            >
              标记这 {picked.size} 个
            </button>
          </div>
        </div>
      )}

      {store.items.length === 0 ? (
        <p className="hint">还没有标记。在动作详情页可以单个标记。</p>
      ) : (
        <div className="contra-list">
          {store.items.map((c) => {
            const info = dataset.byId.get(c.exerciseId);
            const over = isExpired(c);
            return (
              <div className={`contra-item ${over ? 'contra-item-over' : ''}`} key={c.exerciseId}>
                <button className="contra-item-name" onClick={() => onOpenExercise(c.exerciseId)}>
                  {info?.nameZh ?? c.exerciseId}
                </button>
                <span className="contra-item-dates">
                  自 {c.since.slice(5)}
                  {c.until && ` · 预计 ${c.until.slice(5)} 恢复`}
                  {over && <em className="contra-over-tag">已过期</em>}
                </span>
                {c.note && <span className="contra-item-note">{c.note}</span>}
                <button className="contra-item-del" onClick={() => store.unmark(c.exerciseId)}>
                  解除
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
