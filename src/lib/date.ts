/**
 * 本地日期 YYYY-MM-DD。
 *
 * **不要用 `new Date().toISOString().slice(0, 10)`** —— 那是 UTC。
 * 在东八区，晚上 8 点之后导出/记录，会被算成第二天。白天测不出来，晚上才发作。
 *
 * `toISOString()` 用在时间戳上是对的（`finishedAt`、`exportedAt`），
 * 但**任何要当作「哪一天」的值都必须走这里**。
 */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
