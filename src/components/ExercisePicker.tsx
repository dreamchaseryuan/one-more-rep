import { useEffect, useMemo, useState } from 'react';
import { search, type Dataset } from '../lib/data';

interface Props {
  dataset: Dataset;
  /** 已经在今日训练里的动作，标出来但允许再加（同一动作可能练两轮） */
  added: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}

const LIMIT = 40;

export function ExercisePicker({ dataset, added, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const results = useMemo(
    () => search(dataset.exercises, query).slice(0, LIMIT),
    [dataset.exercises, query],
  );

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer picker" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>添加动作</h2>
          <button className="btn-close" onClick={onClose} title="关闭">
            ✕
          </button>
        </header>

        <input
          className="search picker-search"
          type="search"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜动作、肌群、器械…"
        />

        <p className="picker-hint">
          {query ? `${results.length}${results.length === LIMIT ? '+' : ''} 个匹配` : '输入关键词，或直接挑常做的'}
        </p>

        <div className="picker-list">
          {results.map((e) => (
            <button key={e.id} className="picker-item" onClick={() => onPick(e.id)}>
              <span className="picker-name">
                {e.nameZh}
                {added.has(e.id) && <span className="picker-added">已在训练中</span>}
              </span>
              <span className="picker-meta">
                {e.targetZh} · {e.equipmentZh}
              </span>
            </button>
          ))}
          {results.length === 0 && <p className="picker-hint">没有匹配的动作</p>}
        </div>
      </aside>
    </div>
  );
}
