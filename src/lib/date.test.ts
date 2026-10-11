import { describe, expect, it } from 'vitest';
import { localDate } from './date';

/**
 * 这组用例钉在 Asia/Shanghai（UTC+8）上，由 vitest.config.ts 设置。
 *
 * 本文件不只测 localDate —— 它同时是**时区钉死的守卫**。
 * 如果哪天有人把 vitest.config.ts 里那行 `process.env.TZ` 删了，CI 会退回 UTC，
 * 下面「凌晨」那条的第一个断言就会失败，而不是安静地通过。
 */
describe('localDate', () => {
  it('返回本地日期，补零到 YYYY-MM-DD', () => {
    expect(localDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDate(new Date(2026, 8, 9))).toBe('2026-09-09');
    expect(localDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('凌晨取本地日期，不取 UTC 的前一天', () => {
    // 本地 2026-10-11 07:00 = UTC 2026-10-10 23:00
    const d = new Date(2026, 9, 11, 7, 0);

    // 这一条同时在守着 TZ：只有真的跑在 UTC+8 才会成立
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-10');

    // 而 localDate 必须给出本地那一天
    expect(localDate(d)).toBe('2026-10-11');
  });

  it('当天其余时段与 UTC 表示相同 —— 所以这个 bug 白天测不出来', () => {
    // 早上 8 点之后，UTC 已经跨到同一天，两种写法结果一致。
    // 这正是它当初能活下来的原因：随手一试是测不出来的。
    for (const h of [9, 12, 20, 23]) {
      const d = new Date(2026, 9, 11, h, 0);
      expect(d.toISOString().slice(0, 10)).toBe(localDate(d));
    }
  });

  it('跨月与跨年的边界也取本地日期', () => {
    expect(localDate(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    expect(localDate(new Date(2027, 0, 1, 3, 0))).toBe('2027-01-01');
  });

  it('不传参数时用当前时间', () => {
    expect(localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
