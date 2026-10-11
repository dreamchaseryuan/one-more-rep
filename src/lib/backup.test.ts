import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from './backup';
import type { Workout } from '../types';

/**
 * 导入的文件是**外部输入**，不能信。而且它是使用者唯一的救命稻草 ——
 * 换设备、清缓存之后，那个 JSON 是训练记录仅存的载体。
 * 所以这里重点测「坏输入不会把好数据处理坏」和「旧版本能读进来」。
 */

const workout = (id: string): Workout => ({
  id,
  date: '2026-10-11',
  entries: [{ exerciseId: '0025', sets: [{ weight: '60', reps: '8', done: true, touched: true }] }],
  finishedAt: '2026-10-11T10:00:00.000Z',
});

const wrap = (body: unknown) => JSON.stringify(body);

describe('parseBackup —— 坏输入一律拒绝，且说明原因', () => {
  it('不是合法 JSON', () => {
    const r = parseBackup('{ 这不是 json');
    expect(r.backup).toBeNull();
    expect(r.error).toBe('不是合法的 JSON 文件');
    expect(r.fromVersion).toBe(0);
  });

  it('不是对象', () => {
    for (const bad of ['"字符串"', '42', 'null', 'true']) {
      const r = parseBackup(bad);
      expect(r.backup).toBeNull();
      expect(r.error).toBe('文件内容不是一个对象');
    }
  });

  it('JSON 数组会被当成「不是本应用的备份文件」—— 两条消息都准确，不改代码', () => {
    // `[]` 的 typeof 是 'object' 且不是 null，所以它穿过了「不是对象」那一关，
    // 落到 app 标记的检查上。对使用者来说两条消息都说得通（一个数组确实不是备份文件），
    // 所以这里锁住的是「会被拒绝且给出可读原因」，而不是具体是哪一条。
    const r = parseBackup('[]');
    expect(r.backup).toBeNull();
    expect(['文件内容不是一个对象', '这不是本应用的备份文件']).toContain(r.error);
  });

  it('不是本应用的备份文件（app 标记不对）', () => {
    const r = parseBackup(wrap({ app: '别的应用', workouts: [] }));
    expect(r.backup).toBeNull();
    expect(r.error).toBe('这不是本应用的备份文件');
  });

  it('缺 workouts 字段', () => {
    const r = parseBackup(wrap({ app: 'one-more-rep' }));
    expect(r.backup).toBeNull();
    expect(r.error).toBe('备份里没有 workouts 字段');
  });
});

describe('parseBackup —— 旧版本兼容（四个版本都要能读进来）', () => {
  it('v1：只有 workouts 和 favorites，其余取空、不猜', () => {
    const r = parseBackup(wrap({ app: 'one-more-rep', version: 1, workouts: [workout('w1')], favorites: ['0025'] }));
    expect(r.error).toBeNull();
    expect(r.fromVersion).toBe(1);
    expect(r.backup?.workouts).toHaveLength(1);
    expect(r.backup?.favorites).toEqual(['0025']);
    // v1 没有这些字段 —— 缺省成空，不要去猜使用者的意图
    expect(r.backup?.programId).toBeNull();
    expect(r.backup?.programs).toEqual([]);
    expect(r.backup?.contraindications).toEqual([]);
  });

  it('v1 连 version 字段都没有时，当成 v1', () => {
    const r = parseBackup(wrap({ app: 'one-more-rep', workouts: [] }));
    expect(r.fromVersion).toBe(1);
    expect(r.backup).not.toBeNull();
  });

  it('v2：有 programId，仍没有 programs 和 contraindications', () => {
    const r = parseBackup(
      wrap({ app: 'one-more-rep', version: 2, workouts: [workout('w1')], programId: 'ppl' }),
    );
    expect(r.fromVersion).toBe(2);
    expect(r.backup?.programId).toBe('ppl');
    expect(r.backup?.programs).toEqual([]);
    expect(r.backup?.contraindications).toEqual([]);
  });

  it('v3：有计划定义，没有禁忌', () => {
    const programs = [{ id: 'ppl', name: '推拉腿', days: [{ name: '推日', exercises: [] }] }];
    const r = parseBackup(wrap({ app: 'one-more-rep', version: 3, workouts: [], programs }));
    expect(r.fromVersion).toBe(3);
    expect(r.backup?.programs).toHaveLength(1);
    expect(r.backup?.contraindications).toEqual([]);
  });

  it('v4：四样俱全', () => {
    const r = parseBackup(
      wrap({
        app: 'one-more-rep',
        version: 4,
        workouts: [workout('w1')],
        favorites: ['0025'],
        programId: 'ppl',
        programs: [{ id: 'ppl', name: '推拉腿', days: [] }],
        contraindications: [{ exerciseId: '0405', since: '2026-09-01', until: '2026-10-01', note: '右肩' }],
      }),
    );
    expect(r.fromVersion).toBe(4);
    expect(r.backup?.contraindications).toHaveLength(1);
    expect(r.backup?.contraindications[0].note).toBe('右肩');
  });

  it('无论哪个版本，导入结果的 version 都归一成当前版本', () => {
    const r = parseBackup(wrap({ app: 'one-more-rep', version: 1, workouts: [] }));
    expect(r.backup?.version).toBe(4);
  });
});

describe('parseBackup —— 形状不对的条目被丢掉并计数', () => {
  it('缺 id / date / entries 的记录被过滤，skipped 报出条数', () => {
    const r = parseBackup(
      wrap({
        app: 'one-more-rep',
        version: 4,
        workouts: [
          workout('good'),
          { date: '2026-10-11', entries: [] }, // 缺 id
          { id: 'x', entries: [] }, // 缺 date
          { id: 'y', date: '2026-10-11' }, // 缺 entries
          { id: 'z', date: '2026-10-11', entries: [{ sets: [] }] }, // 缺 exerciseId
          null,
        ],
      }),
    );
    expect(r.backup?.workouts.map((w) => w.id)).toEqual(['good']);
    expect(r.skipped).toBe(5);
  });

  it('坏数据不会让好数据一起丢掉', () => {
    const r = parseBackup(
      wrap({ app: 'one-more-rep', version: 4, workouts: [workout('a'), 'garbage', workout('b')] }),
    );
    expect(r.backup?.workouts.map((w) => w.id)).toEqual(['a', 'b']);
    expect(r.skipped).toBe(1);
  });

  it('favorites 里的非字符串被过滤', () => {
    const r = parseBackup(wrap({ app: 'one-more-rep', version: 4, workouts: [], favorites: ['a', 1, null, 'b'] }));
    expect(r.backup?.favorites).toEqual(['a', 'b']);
  });

  it('形状不对的计划与禁忌被过滤', () => {
    const r = parseBackup(
      wrap({
        app: 'one-more-rep',
        version: 4,
        workouts: [],
        programs: [{ id: 'ok', name: '好的', days: [] }, { name: '缺 id', days: [] }, { id: 'x', name: '缺 days' }],
        contraindications: [{ exerciseId: 'a', since: '2026-01-01' }, { exerciseId: 'b' }, { since: '2026-01-01' }],
      }),
    );
    expect(r.backup?.programs.map((p) => p.id)).toEqual(['ok']);
    expect(r.backup?.contraindications).toHaveLength(1);
  });
});

describe('buildBackup ↔ parseBackup 往返', () => {
  it('导出的内容原样读得回来', () => {
    const workouts = [workout('w1'), workout('w2')];
    const favorites = ['0025', '0314'];
    const programs = [{ id: 'ppl', name: '推拉腿', days: [{ name: '推日', focus: '', warmup: [], exercises: [] }] }];
    const contraindications = [{ exerciseId: '0405', since: '2026-09-01' }];

    const exported = buildBackup(workouts, favorites, 'ppl', programs, contraindications);
    const r = parseBackup(JSON.stringify(exported));

    expect(r.error).toBeNull();
    expect(r.skipped).toBe(0);
    expect(r.backup?.workouts.map((w) => w.id)).toEqual(['w1', 'w2']);
    expect(r.backup?.favorites).toEqual(favorites);
    expect(r.backup?.programId).toBe('ppl');
    expect(r.backup?.programs).toEqual(programs);
    expect(r.backup?.contraindications).toEqual(contraindications);
  });

  it('导出的文件带应用标记与版本号，缺了就会被别的应用的文件混进来', () => {
    const b = buildBackup([], [], null, [], []);
    expect(b.app).toBe('one-more-rep');
    expect(b.version).toBe(4);
  });

  it('改名**之前**导出的备份仍然能导入 —— 旧标签不能被丢掉', () => {
    // 2026-10-11 应用从 fitness-app 改名成 one-more-rep，备份的身份串跟着换了。
    // 这条守着 LEGACY_TAGS：删掉它，改名那一刻之前导出的每一份备份都会变成废 JSON，
    // 而备份是换设备时的唯一通路（localStorage 不跟人走）。
    const r = parseBackup(wrap({ app: 'fitness-app', version: 4, workouts: [workout('w1')] }));
    expect(r.backup).not.toBeNull();
    expect(r.backup?.workouts.map((w) => w.id)).toEqual(['w1']);
    // 导回来之后再导出，写的是**新**标签
    expect(buildBackup(r.backup!.workouts, [], null, [], []).app).toBe('one-more-rep');
  });
});
