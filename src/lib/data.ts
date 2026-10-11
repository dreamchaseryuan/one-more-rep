import type { Exercise, FilterKey, Filters, IndexedExercise } from '../types';

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

/**
 * 读媒体清单。**失败一律当成「没有媒体」，不抛异常。**
 *
 * 不能只看 `res.ok`：媒体没下过时（没跑 `media:fetch`），dev server 和不少静态主机的
 * SPA fallback 会返回 `index.html` **配 200**，于是 `res.ok` 为真、`.json()` 抛
 * `Unexpected token '<'`。而这个异常会冒出去让整个应用显示「数据加载失败」，
 * 把使用者引去查动作数据 —— 完全指错方向。
 *
 * 而媒体本来就是**可选依赖**（见 README「已知取舍」），没有它应用应该照常能用，
 * 只是图显示成占位。所以这里吞掉所有失败。
 */
async function loadMediaFiles(): Promise<Set<string>> {
  try {
    const res = await fetch(`${BASE}media/index.json`);
    if (!res.ok) return new Set();
    const json = (await res.json()) as { files?: unknown };
    return new Set(Array.isArray(json.files) ? (json.files as string[]) : []);
  } catch {
    return new Set();
  }
}

let cache: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  cache ??= (async () => {
    const [exRes, mediaFiles] = await Promise.all([
      fetch(`${BASE}data/exercises.json`),
      loadMediaFiles(),
    ]);
    if (!exRes.ok) throw new Error(`加载动作数据失败: HTTP ${exRes.status}`);

    let raw: Exercise[];
    try {
      raw = await exRes.json();
    } catch {
      // 同一种坑：文件不在时服务器可能给 index.html + 200，错误原文是
      // `Unexpected token '<'`，对着它查不出问题。给一句人话。
      throw new Error('动作数据不是合法 JSON —— 多半是 public/data/exercises.json 还没生成');
    }

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

export function hasLocalMedia(dataset: Dataset, rel: string): boolean {
  return dataset.mediaFiles.has(rel);
}

/**
 * 媒体地址。**没有兜底** —— 本地没有就返回 `null`，调用方必须自己画出「没有图」的样子。
 *
 * 这里原来会回退到 `raw.githubusercontent.com`。删掉它有三个理由：
 *
 * 1. **它是假的兜底。** 那个域名在国内基本不通。注释写的是「保证任何情况下都有图」，
 *    实际是「任何情况下都挂在那儿等超时」—— 比直接显示「没有图」更糟，因为使用者
 *    看不出是在等还是在坏。
 * 2. **它永远不会被缓存。** 那个 URL 里没有 `/media/` 路径段，匹配不上 workbox 的
 *    运行时缓存规则，所以连「看过一次以后就有了」这个最低限度的好处都拿不到。
 * 3. **它把请求发给第三方**，而这份媒体的授权是随本应用走的（见 data/NOTICE.md）。
 *
 * 返回 `null` 而不是一个注定 404 的路径，是为了让 TypeScript 逼着调用方处理这种情况 ——
 * 它在**开发时**（没跑 `media:fetch`）和**弱网/离线时**都会出现，后者在健身房是常态。
 */
export function mediaUrl(dataset: Dataset, rel: string): string | null {
  return dataset.mediaFiles.has(rel) ? `${BASE}media/${rel}` : null;
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
