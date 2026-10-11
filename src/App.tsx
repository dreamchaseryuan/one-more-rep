import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { applyFilters, loadDataset, search, type Dataset } from './lib/data';
import { useFavorites } from './lib/useFavorites';
import { useWorkouts } from './lib/useWorkouts';
import { usePrograms } from './lib/usePrograms';
import { useContraindications } from './lib/useContraindications';
import {
  EMPTY_FILTERS,
  type Filters,
  type IndexedExercise,
  type LoggedExercise,
  type Tab,
  type WorkoutDaySnapshot,
} from './types';
import { FilterBar } from './components/FilterBar';
import { ExerciseCard } from './components/ExerciseCard';
import { DetailPanel } from './components/DetailPanel';
import { WorkoutPanel } from './components/WorkoutPanel';
import { ProgramPanel } from './components/ProgramPanel';

const PAGE_SIZE = 48;

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<IndexedExercise | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const { ids: favorites, toggle: toggleFavorite, merge: mergeFavorites } = useFavorites();
  const store = useWorkouts();
  const programStore = usePrograms();
  const contraStore = useContraindications();

  const startProgramDay = (entries: LoggedExercise[], day: WorkoutDaySnapshot) => {
    store.startWithEntries(entries, day);
    /*
     * 滚到训练中面板。
     *
     * 不加这一下的话，点「开始推日」屏幕上**什么都不变** —— 计划面板在上面、占了整屏，
     * 训练中面板在它下面。热身现在就在训练中面板里（挪过去了，见 WorkoutPanel），
     * 所以不滚过去等于没挪。等 React 画完再滚：`startWithEntries` 只是 setState。
     */
    requestAnimationFrame(() => {
      document.querySelector('.today')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    loadDataset()
      .then(setDataset)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    if (!dataset) return [];
    const byFav = favoritesOnly
      ? dataset.exercises.filter((e) => favorites.has(e.id))
      : dataset.exercises;
    return search(applyFilters(byFav, filters), deferredQuery);
  }, [dataset, deferredQuery, filters, favoritesOnly, favorites]);

  /**
   * 使用者有没有**主动把范围缩小过**（搜了词、选了部位/器械、或者只看收藏）。
   *
   * **没缩过就不铺结果。** 打开就把 1324 个动作全摊出来，并不能帮人找到东西 ——
   * 「1324 个结果」这个数字既不是选项也不是答案，只是一面墙；而且它把真正有用的
   * 东西（筛选面板）挤到了下面。等到有搜索词或条件了，结果才有意义。
   *
   * 用 `deferredQuery` 而不是 `query`：结果列表本身是按 deferred 值算的，
   * 两边用不同的值会出现「面板收起了但结果还没算出来」的空窗。
   */
  const activeFilterCount =
    filters.bodyPart.length + filters.equipment.length + filters.target.length;
  const narrowed = deferredQuery.trim() !== '' || activeFilterCount > 0 || favoritesOnly;

  const inWorkout = useMemo(
    () => new Set(store.current?.entries.map((e) => e.exerciseId) ?? []),
    [store.current],
  );

  // 换关键词/条件后回到第一页
  useEffect(() => setVisible(PAGE_SIZE), [deferredQuery, filters, favoritesOnly]);

  if (error) {
    return (
      <div className="center-state">
        <h1>数据加载失败</h1>
        <p>{error}</p>
        <p className="hint">
          先跑 <code>npm run data:build</code> 生成 <code>public/data/exercises.json</code>
        </p>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="center-state">
        <h1>加载动作库…</h1>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>动作库</strong>
          <span className="brand-count">{dataset.exercises.length} 个动作</span>
        </div>

        <nav className="tabs">
          <button
            className={`tab ${tab === 'library' ? 'tab-on' : ''}`}
            onClick={() => setTab('library')}
          >
            动作库
          </button>
          <button className={`tab ${tab === 'log' ? 'tab-on' : ''}`} onClick={() => setTab('log')}>
            训练记录
            {inWorkout.size > 0 && <span className="tab-badge">{inWorkout.size}</span>}
          </button>
        </nav>

        {tab === 'library' && (
          <>
            <div className="search-wrap">
              <input
                className="search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜动作、肌群、器械… 例：卧推 / 哑铃 / 腘绳肌"
                autoComplete="off"
              />
              {query && (
                <button className="search-clear" onClick={() => setQuery('')} title="清空">
                  ✕
                </button>
              )}
            </div>
            <button
              className={`chip chip-fav ${favoritesOnly ? 'chip-on' : ''}`}
              onClick={() => setFavoritesOnly((v) => !v)}
              title="只看收藏"
            >
              ★ {favorites.size}
            </button>
          </>
        )}
      </header>

      <main className="main">
        {tab === 'library' ? (
          <>
            {/* 还没缩范围：一句话说明为什么没有结果。
                它必须在筛选面板**上面** —— 面板在手机上占 478px，放下面就掉出首屏，
                等于没人看得到「为什么这里是空的」。 */}
            {!narrowed && (
              <p className="library-start hint">
                库里一共 {dataset.exercises.length} 个动作，全摊开只会淹掉你要找的那个。
                先选个部位或器械，或者直接用上面的搜索框 —— 出来之后再按关键词细找。
              </p>
            )}

            <FilterBar
              dataset={dataset}
              filters={filters}
              onChange={setFilters}
              narrowed={narrowed}
            />

            {narrowed && (
              <>
                <div className="result-head">
                  <span>
                    {results.length} 个结果
                    {deferredQuery && <> · 关键词「{deferredQuery}」</>}
                  </span>
                  {favoritesOnly && <span className="hint">仅收藏</span>}
                </div>

                {results.length === 0 ? (
                  <div className="empty">
                    <p>没有匹配的动作。</p>
                    <button
                      className="btn-text"
                      onClick={() => {
                        setQuery('');
                        setFilters(EMPTY_FILTERS);
                        setFavoritesOnly(false);
                      }}
                    >
                      清空搜索和筛选
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid">
                      {results.slice(0, visible).map((e) => (
                        <ExerciseCard
                          key={e.id}
                          exercise={e}
                          dataset={dataset}
                          favorite={favorites.has(e.id)}
                          blocked={contraStore.blocked(e.id)}
                          onToggleFavorite={toggleFavorite}
                          onOpen={setSelected}
                        />
                      ))}
                    </div>
                    {visible < results.length && (
                      <button
                        className="btn-more"
                        onClick={() => setVisible((v) => v + PAGE_SIZE)}
                      >
                        显示更多（还有 {results.length - visible} 个）
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <ProgramPanel
              dataset={dataset}
              store={store}
              programStore={programStore}
              contraStore={contraStore}
              onOpenExercise={setSelected}
              onStartDay={startProgramDay}
            />
            <WorkoutPanel
              dataset={dataset}
              store={store}
              onOpenExercise={setSelected}
              favorites={favorites}
              onMergeFavorites={mergeFavorites}
              programStore={programStore}
              contraStore={contraStore}
            />
          </>
        )}
      </main>

      {selected && (
        <DetailPanel
          exercise={selected}
          dataset={dataset}
          favorite={favorites.has(selected.id)}
          onToggleFavorite={toggleFavorite}
          onClose={() => setSelected(null)}
          onSelect={setSelected}
          onAddToWorkout={store.startWith}
          inWorkout={inWorkout.has(selected.id)}
          activeWorkout={!!store.current}
          contraStore={contraStore}
        />
      )}
    </div>
  );
}
