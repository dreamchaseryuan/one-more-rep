import { describe, expect, it } from 'vitest';
import { nextDayIndex, rampText, rampUpSets, repRangeText, type Program, type ProgramDay } from './programs';

const day = (name: string): ProgramDay => ({ name, focus: '', warmup: [], exercises: [] });
const program = (...names: string[]): Program => ({ id: 'p', name: '测试计划', days: names.map(day) });

describe('nextDayIndex —— 轮转必须按训练日**名字**推导', () => {
  it('还没练过时从第一天开始', () => {
    expect(nextDayIndex(program('推日', '拉日', '腿日'), null)).toBe(0);
  });

  it('按顺序往下走', () => {
    const p = program('推日', '拉日', '腿日');
    expect(nextDayIndex(p, { dayName: '推日', dayIndex: 0 })).toBe(1);
    expect(nextDayIndex(p, { dayName: '拉日', dayIndex: 1 })).toBe(2);
  });

  it('走到最后一天回到第一天', () => {
    expect(nextDayIndex(program('推日', '拉日', '腿日'), { dayName: '腿日', dayIndex: 2 })).toBe(0);
  });

  it('在计划最前面插入一个训练日后，轮转仍然正确', () => {
    // 这是「按下标推导」会安静出错的那个场景。
    //
    // 历史里记着「推日（下标 0）」。使用者后来在计划最前面加了「手臂日」，
    // 于是所有历史记录的下标语义整体右移一位：
    //
    //   按下标：(0 + 1) % 4 = 1 → 手臂日  ← 错，会让他再练一遍推日
    //   按名字：'推日' 现在在第 1 位 → (1 + 1) % 4 = 2 → 拉日  ✓
    //
    // 而且它不报错，只是安静地让你练错日子 —— 练错好几天才可能发现。
    const withArm = program('手臂日', '推日', '拉日', '腿日');

    expect((0 + 1) % 4).toBe(1); // 按下标会得到「手臂日」
    expect(nextDayIndex(withArm, { dayName: '推日', dayIndex: 0 })).toBe(2); // 按名字得到「拉日」
    expect(withArm.days[2].name).toBe('拉日');
  });

  it('重排训练日之后同样按名字走', () => {
    const reordered = program('腿日', '推日', '拉日');
    expect(nextDayIndex(reordered, { dayName: '推日', dayIndex: 0 })).toBe(2);
  });

  it('名字找不到了（改名或删除）才退回按下标', () => {
    const renamed = program('胸日', '背日', '腿日');
    // 历史里记的是旧名字「推日」，现在不存在了
    expect(nextDayIndex(renamed, { dayName: '推日', dayIndex: 0 })).toBe(1);
    // 下标越界时也要回绕，不能给出 undefined
    expect(nextDayIndex(renamed, { dayName: '推日', dayIndex: 2 })).toBe(0);
  });

  it('只有一天的计划，下一天永远是它自己', () => {
    expect(nextDayIndex(program('全身'), { dayName: '全身', dayIndex: 0 })).toBe(0);
  });
});

describe('rampUpSets —— 递增组', () => {
  it('低于 40kg 不给递增组（空杆占的比例太大，热身意义不大）', () => {
    expect(rampUpSets(null)).toEqual([]);
    expect(rampUpSets(0)).toEqual([]);
    expect(rampUpSets(20)).toEqual([]);
    expect(rampUpSets(39.9)).toEqual([]);
  });

  it('62.5kg 的完整例子与文档一致', () => {
    // README 里写的就是这条：62.5kg → 20×10 → 25×5 → 37.5×3 → 50×1
    expect(rampUpSets(62.5)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 25, reps: 5 },
      { weight: 37.5, reps: 3 },
      { weight: 50, reps: 1 },
    ]);
    expect(rampText(rampUpSets(62.5))).toBe('20×10 → 25×5 → 37.5×3 → 50×1');
  });

  it('第一组永远是空杆 20kg × 10', () => {
    for (const working of [40, 60, 62.5, 80, 100, 140]) {
      expect(rampUpSets(working)[0]).toEqual({ weight: 20, reps: 10 });
    }
  });

  it('任何递增组都不等于或超过工作重量', () => {
    // 给出一组「热身」却等于正式重量，会让使用者按正式组去做一个本不该做的次数
    for (let working = 40; working <= 200; working += 2.5) {
      for (const set of rampUpSets(working)) {
        expect(set.weight).toBeLessThan(working);
      }
    }
  });

  it('重量严格递增且不重复', () => {
    for (let working = 40; working <= 200; working += 2.5) {
      const weights = rampUpSets(working).map((s) => s.weight);
      expect(new Set(weights).size).toBe(weights.length);
      expect([...weights].sort((a, b) => a - b)).toEqual(weights);
    }
  });

  it('所有重量都落在 2.5kg 的档位上', () => {
    // 现实约束：最小配重片两片共 2.5kg，给不出 21.3 这种数字
    for (let working = 40; working <= 200; working += 2.5) {
      for (const set of rampUpSets(working)) {
        expect((set.weight * 10) % 25).toBe(0);
      }
    }
  });

  it('次数由重到轻递减', () => {
    expect(rampUpSets(100).map((s) => s.reps)).toEqual([10, 5, 3, 1]);
  });
});

describe('repRangeText', () => {
  it('区间与固定次数', () => {
    expect(repRangeText([6, 8])).toBe('6~8 次');
    expect(repRangeText([5, 5])).toBe('5 次');
    expect(repRangeText([12, 15])).toBe('12~15 次');
  });
});
