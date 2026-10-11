import { useState } from 'react';
import type { Dataset } from '../lib/data';
import type { FilterKey, Filters } from '../types';

const GROUPS: { key: FilterKey; title: string }[] = [
  { key: 'bodyPart', title: '部位' },
  { key: 'equipment', title: '器械' },
  { key: 'target', title: '目标肌' },
];

const COLLAPSED_COUNT = 8;

/** 窄屏（手机）。和应用里唯一的断点保持一致，见 styles.css 的 @media */
const NARROW = '(max-width: 720px)';

interface Props {
  dataset: Dataset;
  filters: Filters;
  onChange: (next: Filters) => void;
}

export function FilterBar({ dataset, filters, onChange }: Props) {
  /**
   * 整块筛选面板开合。**手机上默认收起。**
   *
   * 收起的理由：三排 chip 在 390px 上要占掉约 500px，也就是首屏的六成 ——
   * 得往下滚过大半屏才看见第一个动作。而多数时候使用者是用关键词搜的，
   * 筛选是偶尔才用一次的东西，不该常驻。
   *
   * 桌面宽度够，默认展开，不给人多一次点击。
   */
  const [open, setOpen] = useState(() => !window.matchMedia(NARROW).matches);

  /** 每个维度内部的「+N」展开（和上面那个整块开合是两回事） */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const activeCount = Object.values(filters).reduce((n, v) => n + v.length, 0);

  const toggle = (key: FilterKey, value: string) => {
    const current = filters[key];
    onChange({
      ...filters,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  const clearAll = () => onChange({ bodyPart: [], equipment: [], target: [] });

  /** 已选条件的名字，收起时要摆出来 */
  const active = GROUPS.flatMap(({ key }) =>
    filters[key].map((value) => ({
      key,
      value,
      label: dataset.options[key].find((o) => o.value === value)?.label ?? value,
    })),
  );

  return (
    <div className="filters">
      <div className="filters-head">
        <button
          className="filters-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="filters-caret">{open ? '▾' : '▸'}</span>
          筛选
          {activeCount > 0 && <span className="filters-badge">{activeCount}</span>}
        </button>
        {activeCount > 0 && (
          <button className="btn-text" onClick={clearAll}>
            清除全部
          </button>
        )}
      </div>

      {/*
        收起时**必须把已选条件摆出来**。
        否则条件还在生效、结果却莫名变少，使用者看不出是为什么 ——
        而这种「安静地少给东西」是这个项目反复踩到的同一类坑。
        点一下就能摘掉，不用先展开面板。
      */}
      {!open && active.length > 0 && (
        <div className="chips filters-applied">
          {active.map((a) => (
            <button
              key={`${a.key}:${a.value}`}
              className="chip chip-on"
              onClick={() => toggle(a.key, a.value)}
              title="点一下移除这个条件"
            >
              {a.label}
              <span className="chip-x">×</span>
            </button>
          ))}
        </div>
      )}

      {open &&
        GROUPS.map(({ key, title }) => {
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
                  <button
                    className="chip chip-more"
                    onClick={() => setExpanded((p) => ({ ...p, [key]: !isOpen }))}
                  >
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
