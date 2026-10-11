/**
 * 本地日期 YYYY-MM-DD。
 *
 * **不要用 `new Date().toISOString().slice(0, 10)`** —— 那是 UTC。
 *
 * 在东八区，本地时间**早于 08:00** 时 UTC 还停在前一天（本地 07:00 = UTC 前一天 23:00），
 * 于是「今天」会被写成**昨天**。早上 8 点之后两者重合。
 *
 * 注意方向：是**凌晨**出问题、写成**前一天**，不是晚上写成第二天
 * （本地 20:00 = UTC 12:00，还是同一天）。而且白天怎么试都是对的 ——
 * 这正是它当初能活下来的原因。
 *
 * `toISOString()` 用在时间戳上是对的（`finishedAt`、`exportedAt`），
 * 但**任何要当作「哪一天」的值都必须走这里**。
 *
 * 见 `date.test.ts`：那组用例把时区钉在 UTC+8 并守着这条边界。
 */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
