// 必须在任何 Date 被创建之前设置，所以放在模块顶层而不是 test.env 里。
//
// 为什么非要钉死：本机默认是 Asia/Shanghai（UTC+8），而 CI 跑在 GitHub 的 runner 上是
// **UTC**。在 UTC 下 `toISOString()` 恰好等于本地日期，于是 localDate 的时区用例会
// **假通过**——那正是这个项目踩过的第一个 bug，测试却在两处一致地放过它。
//
// 钉在 UTC+8 是因为这是使用者的真实环境：凌晨 08:00 之前，UTC 还停在前一天，
// 这正是 toISOString 会算错的那个窗口。
process.env.TZ = 'Asia/Shanghai';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 测的都是纯函数（localDate / isFilled / nextDayIndex / rampUpSets / parseBackup），
    // 不需要 DOM。真要用到 localStorage 或 React 时再换 jsdom，别提前背上这个依赖。
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
