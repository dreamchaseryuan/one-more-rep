import { useState } from 'react';
import type { Dataset } from '../lib/data';
import type { FilterKey, Filters } from '../types';

const GROUPS: { key: FilterKey; title: string }[] = [
  { key: 'bodyPart', title: '部位' },
  { key: 'equipment', title: '器械' },
  { key: 'target', title: '目标肌' },
];

const COLLAPSED_COUNT = 8;

interface Props {
  dataset: Dataset;
  filters: Filters;
  onChange: (next: Filters) => void;
}

export function FilterBar({ dataset, filters, onChange }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const activeCount = Object.values(filters).reduce((n, v) => n + v.length, 0);

  const toggle = (key: FilterKey, value: string) => {
    const current = filters[key];
    onChange({
      ...filters,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  return (
    <div className="filters">
      {activeCount > 0 && (
        <div className="filters-head">
          <span className="filters-active">已选 {activeCount} 个条件</span>
          <button className="btn-text" onClick={() => onChange({ bodyPart: [], equipment: [], target: [] })}>
            清除全部
          </button>
        </div>
      )}

      {GROUPS.map(({ key, title }) => {
        const options = dataset.options[key];
        const isOpen = expanded[key];
        const visible = isOpen ? options : options.slice(0, COLLAPSED_COUNT);
        return (
          <div className="filter-group" key={key}>
            <div className="filter-title">
              {title}
              <span className="filter-dim">{options.length}</span>
            </div>
            <div className="chips">
              {visible.map((o) => (
                <button
                  key={o.value}
                  className={`chip ${filters[key].includes(o.value) ? 'chip-on' : ''}`}
                  onClick={() => toggle(key, o.value)}
                >
                  {o.label}
                  <span className="chip-count">{o.count}</span>
                </button>
              ))}
              {options.length > COLLAPSED_COUNT && (
                <button className="chip chip-more" onClick={() => setExpanded((p) => ({ ...p, [key]: !isOpen }))}>
                  {isOpen ? '收起' : `+${options.length - COLLAPSED_COUNT}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
