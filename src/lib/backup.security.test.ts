import { describe, expect, it } from 'vitest';
import { parseBackup } from './backup';

/**
 * 安全回归测试 —— 导入的备份文件是**外部输入**（换设备时从别处拿到的 JSON，
 * 可能是别的应用、手改的、或被构造过的）。
 *
 * 和 `backup.test.ts` 的分工：那边测「形状对不对、旧版本读不读得进」；
 * 这边只测**安全属性**——坏输入不能在运行时造成越界影响。任何一条挂了，
 * 都说明攻击面从「数据完整性」升级成了「代码执行」，必须当事故处理。
 *
 * 背景：2026-10-13 对发布产物做过一轮实测，结论是纯前端 + 无 DOM sink +
 * 无外联的架构下没有可利用漏洞。这个文件把那轮结论固化成不变量。
 */

const wrap = (body: unknown) => JSON.stringify(body);

describe('安全 · 原型污染', () => {
  it('顶层带 __proto__ / constructor 的备份不会污染 Object.prototype', () => {
    // JSON.parse 造出的 `__proto__` 是**自有属性**（不是原型），
    // 而 parseBackup 是逐字段**构造**新对象、从不做递归合并 / Object.assign，
    // 所以没有污染通路。这条守着「以后别改成深合并」。
    const evil = wrap({
      app: 'one-more-rep',
      __proto__: { polluted: 'yes' },
      constructor: { prototype: { polluted2: 'yes' } },
      workouts: [],
    });
    parseBackup(evil);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted2).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('workout 条目内部塞 __proto__ 同样不外溢', () => {
    const evil = wrap({
      app: 'one-more-rep',
      workouts: [
        {
          id: 'w1',
          date: '2026-10-11',
          entries: [{ exerciseId: 'e1', sets: [{ __proto__: { owned: 'yes' } }] }],
        },
      ],
    });
    parseBackup(evil);
    expect(({} as Record<string, unknown>).owned).toBeUndefined();
  });
});

describe('安全 · XSS 载荷只当数据，不在这里执行', () => {
  it('含标签的 id / exerciseId 被原样接收 —— 安全性由渲染层转义兜底', () => {
    // 这是**有意锁定**的行为，不是缺陷：parseBackup 不做 HTML 清洗，
    // 因为这些字符串只会进 React 的文本节点，由 React 转义。
    // 一旦有人加了 dangerouslySetInnerHTML 或 innerHTML，这条数据就活了 ——
    // 所以下面「源码无 HTML sink」那条不变量是这个断言成立的前提，两条是一组。
    const evil = wrap({
      app: 'one-more-rep',
      workouts: [
        {
          id: '<img src=x onerror=alert(1)>',
          date: '2026-10-11',
          entries: [{ exerciseId: '"><script>alert(2)</script>', sets: [{ weight: '60', reps: '8' }] }],
        },
      ],
    });
    const r = parseBackup(evil);
    expect(r.skipped).toBe(0);
    expect(r.backup?.workouts[0].id).toBe('<img src=x onerror=alert(1)>');
    expect(r.backup?.workouts[0].entries[0].exerciseId).toBe('"><script>alert(2)</script>');
  });
});

describe('安全 · 未强校验的字段（记录当前行为，防悄悄变化）', () => {
  it('version 无上限校验，伪造的大版本号原样透出', () => {
    // 低危：version 只用于「这是旧版备份」的提示。这里锁的是**当前**行为，
    // 若哪天加了版本上界拒绝，改这条即可（不是回归，是设计变更）。
    const r = parseBackup(wrap({ app: 'one-more-rep', version: 99999, workouts: [] }));
    expect(r.fromVersion).toBe(99999);
  });

  it('sets 只校验「是对象」，字段内容一律不查', () => {
    // 上限就是「任意形状的 set 都能进」。渲染层拿到 weight/reps 时若假设是数字，
    // 可能显示 [object Object] —— 是展示问题，不是安全问题，但值得知道边界在哪。
    const r = parseBackup(
      wrap({
        app: 'one-more-rep',
        workouts: [{ id: 'w1', date: '2026-10-11', entries: [{ exerciseId: 'e1', sets: [{ any: 'thing' }] }] }],
      }),
    );
    expect(r.skipped).toBe(0);
    expect(r.backup?.workouts[0].entries[0].sets[0]).toEqual({ any: 'thing' });
  });
});

describe('安全不变式 · 源码里不存在 HTML 注入 / 动态执行 sink', () => {
  // 上面「XSS 载荷只当数据」成立，靠的就是这条。把它变成测试，
  // 任何人往 src 里加一个 dangerouslySetInnerHTML，CI 立刻红。
  const FORBIDDEN = [
    'dangerouslySetInnerHTML',
    'innerHTML',
    'outerHTML',
    'insertAdjacentHTML',
    'document.write',
    'eval(',
    'new Function',
  ];

  // 用 Vite 的 raw glob 读源码，**不用 node:fs** —— 本项目 tsconfig 只带 `vite/client`
  // 类型、没装 @types/node，一旦用 node 内建，`tsc --noEmit`（CI 的 npm run build）会直接在
  // 这里报错。glob 由 Vite/vitest 处理，类型也来自 vite/client，零新依赖。
  const sources = import.meta.glob<string>('../**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('src 下没有禁用 sink', () => {
    const hits: string[] = [];
    for (const [path, text] of Object.entries(sources)) {
      // 跳过测试文件自身（它本来就要包含这些串做断言）
      if (path.includes('.test.')) continue;
      for (const bad of FORBIDDEN) {
        if (text.includes(bad)) hits.push(`${path}: ${bad}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
