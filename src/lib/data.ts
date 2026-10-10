import type { Exercise, FilterKey, Filters, IndexedExercise } from '../types';

/** 上游数据集（CC/署名见 NOTICE），本地媒体缺失时回退到这里 */
const MEDIA_RAW = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main';

/**
 * 部署在 GitHub Pages 项目站点时，站点根是 /<仓库名>/ 而不是 /。
 * 所有静态资源路径必须带上 BASE_URL，写死 '/data/...' 会全部 404。
 */
const BASE = import.meta.env.BASE_URL;

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

export interface Dataset {
  exercises: IndexedExercise[];
  /** 本地已下载的媒体路径；缺失时前端不该去请求本地 URL */
  mediaFiles: Set<string>;
  /** 每个筛选维度的可选值，按动作数降序 */
  options: Record<FilterKey, { value: string; label: string; count: number }[]>;
  byId: Map<string, IndexedExercise>;
}

/** 把一条动作拍平成可搜索的长字符串 */
function haystack(e: Exercise): string {
  return normalize(
    [
      e.name,
      e.nameZh,
      e.targetZh,
      e.muscleGroupZh,
      e.bodyPartZh,
      e.equipmentZh,
      ...e.secondaryMusclesZh,
      ...e.aliases,
    ].join(' '),
  );
}

function buildOptions(exercises: Exercise[], key: FilterKey, labelKey: keyof Exercise) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const e of exercises) {
    const value = e[key];
    const label = String(e[labelKey]);
    const hit = counts.get(value);
    if (hit) hit.count++;
    else counts.set(value, { label, count: 1 });
  }
  return [...counts.entries()]
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh'));
}

let cache: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  cache ??= (async () => {
    const [exRes, mediaRes] = await Promise.all([
      fetch(`${BASE}data/exercises.json`),
      fetch(`${BASE}media/index.json`).catch(() => null),
    ]);
    if (!exRes.ok) throw new Error(`加载动作数据失败: HTTP ${exRes.status}`);
    const raw: Exercise[] = await exRes.json();

    const mediaFiles = new Set<string>(
      mediaRes?.ok ? ((await mediaRes.json()).files as string[]) : [],
    );

    const exercises: IndexedExercise[] = raw.map((e) => ({ ...e, haystack: haystack(e) }));

    return {
      exercises,
      mediaFiles,
      byId: new Map(exercises.map((e) => [e.id, e])),
      options: {
        bodyPart: buildOptions(raw, 'bodyPart', 'bodyPartZh'),
        equipment: buildOptions(raw, 'equipment', 'equipmentZh'),
        target: buildOptions(raw, 'target', 'targetZh'),
      },
    };
  })();
  return cache;
}

/** 本地没有就用上游 URL —— 保证任何情况下都有图 */
export function mediaUrl(dataset: Dataset, rel: string): string {
  return dataset.mediaFiles.has(rel) ? `${BASE}media/${rel}` : `${MEDIA_RAW}/${rel}`;
}

export function hasLocalMedia(dataset: Dataset, rel: string): boolean {
  return dataset.mediaFiles.has(rel);
}

/** 多词空格分隔 = AND；中文名命中权重最高 */
export function search(list: IndexedExercise[], query: string): IndexedExercise[] {
  const q = normalize(query);
  if (!q) return list;
  const terms = q.split(' ').filter(Boolean);

  const scored: { e: IndexedExercise; score: number }[] = [];
  for (const e of list) {
    if (!terms.every((t) => e.haystack.includes(t))) continue;
    let score = 0;
    const nameZh = e.nameZh.toLowerCase();
    const name = e.name.toLowerCase();
    for (const t of terms) {
      if (nameZh.startsWith(t)) score += 100;
      else if (nameZh.includes(t)) score += 50;
      if (name.includes(t)) score += 20;
      if (e.targetZh.toLowerCase().includes(t) || e.equipmentZh.toLowerCase().includes(t)) score += 5;
    }
    // 名字短的更可能是核心动作，排前面
    score -= nameZh.length * 0.1;
    scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.e);
}

export function applyFilters(list: IndexedExercise[], filters: Filters): IndexedExercise[] {
  const active = (Object.entries(filters) as [FilterKey, string[]][]).filter(([, v]) => v.length);
  if (!active.length) return list;
  // 同一维度内取并集(OR)，不同维度之间取交集(AND)
  return list.filter((e) => active.every(([key, values]) => values.includes(e[key])));
}
