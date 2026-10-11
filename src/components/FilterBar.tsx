import { useEffect, useState } from 'react';
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

/**
 * 窄屏检测，**跟随窗口变化**。
 *
 * 原先这里是 `useState(() => window.matchMedia(NARROW).matches)` —— 只在挂载那一刻读一次。
 * 后果是转屏、拖窗口、或者开发时改预览宽度，面板都保持挂载时的样子不动。
 * （实测：面板 550px 宽时挂载，之后缩到 375px，面板还开着，占掉首屏 59%。）
 */
function useNarrow(query: string) {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return narrow;
}

interface Props {
  dataset: Dataset;
  filters: Filters;
  onChange: (next: Filters) => void;
  /** 使用者有没有主动缩过范围（搜索词 / 筛选 / 只看收藏）。见 App.tsx 的 `narrowed` */
  narrowed: boolean;
}

export function FilterBar({ dataset, filters, onChange, narrowed }: Props) {
  const narrow = useNarrow(NARROW);

  /**
   * 整块筛选面板开合。规则两条：
   *
   * 1. **手机上出了结果就收起。** 三排 chip 在 375px 上占 478px，是首屏的 59% ——
   *    不收的话第一个动作卡片要滚到 653px 才出现。桌面宽度够，一直开着。
   * 2. **还没缩范围时手机上也要开着**，因为那时候面板**就是**内容：
   *    一个条件都没选的时候不铺结果（见 App.tsx 的 `.library-start`）。
   *
   * `manual` 是「使用者自己点过」的覆盖值，`narrowed` 一变就丢掉、回到自动值 ——
   * 和 ProgramPanel 里 `manual ?? derived` 是同一个写法。
   */
  const [manual, setManual] = useState<boolean | null>(null);
  useEffect(() => setManual(null), [narrowed]);
  const open = manual ?? (!narrow || !narrowed);

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
          onClick={() => setManual(!open)}
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
