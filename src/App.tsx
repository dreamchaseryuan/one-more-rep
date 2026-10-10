import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { applyFilters, loadDataset, search, type Dataset } from './lib/data';
import { useFavorites } from './lib/useFavorites';
import { useWorkouts } from './lib/useWorkouts';
import { usePrograms } from './lib/usePrograms';
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

  const startProgramDay = (entries: LoggedExercise[], day: WorkoutDaySnapshot) => {
    store.startWithEntries(entries, day);
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
            <FilterBar dataset={dataset} filters={filters} onChange={setFilters} />

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
                      onToggleFavorite={toggleFavorite}
                      onOpen={setSelected}
                    />
                  ))}
                </div>
                {visible < results.length && (
                  <button className="btn-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                    显示更多（还有 {results.length - visible} 个）
                  </button>
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
        />
      )}
    </div>
  );
}
