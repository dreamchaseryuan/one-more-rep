import { describe, expect, it } from 'vitest';
import { CARDIO_FINISHERS, PROGRAMS } from './programs';
import { recommend, type Experience, type Goal, type Profile } from './recommend';

const profile = (p: Partial<Profile> = {}): Profile => ({
  experience: 'half',
  daysPerWeek: 4,
  minutes: 60,
  goal: 'muscle',
  ...p,
});

const noteKinds = (r: ReturnType<typeof recommend>) => r.notes.map((n) => n.kind);

describe('recommend —— 一周该练几天的上限', () => {
  it('刚开始练的人说能来 5 天，也只排 3 天，并说明原因', () => {
    const r = recommend(profile({ experience: 'new', daysPerWeek: 5 }));
    expect(r.perWeek).toBe(3);
    expect(noteKinds(r)).toContain('warn');
    expect(r.notes.find((n) => n.kind === 'warn')?.text).toContain('只给你排 3 天');
  });

  it('练了半年到一年，上限 4 天', () => {
    expect(recommend(profile({ experience: 'half', daysPerWeek: 6 })).perWeek).toBe(4);
  });

  it('一年以上不再压上限', () => {
    expect(recommend(profile({ experience: 'year', daysPerWeek: 6 })).perWeek).toBe(6);
  });

  it('没超上限时不出现警告', () => {
    expect(noteKinds(recommend(profile({ experience: 'new', daysPerWeek: 3 })))).not.toContain('warn');
  });
});

describe('recommend —— 挑哪个模板', () => {
  it('一周 2 天 → 上下肢分化，且只留两个训练日', () => {
    const r = recommend(profile({ daysPerWeek: 2 }));
    expect(r.templateId).toBe('upper-lower');
    expect(r.days).toHaveLength(2);
    expect(noteKinds(r)).toContain('trim');
  });

  it('一周 3 天 → 推拉腿', () => {
    expect(recommend(profile({ daysPerWeek: 3 })).templateId).toBe('ppl');
  });

  it('一周 4 天：老手四分化、其他人上下肢分化', () => {
    expect(recommend(profile({ daysPerWeek: 4, experience: 'year' })).templateId).toBe('four-way');
    expect(recommend(profile({ daysPerWeek: 4, experience: 'half' })).templateId).toBe('upper-lower');
  });

  it('一周 5 天 → 五分化', () => {
    expect(recommend(profile({ daysPerWeek: 5, experience: 'year' })).templateId).toBe('five-way');
  });

  it('一周 6 天 → 推拉腿跑两轮（perWeek 大于训练日数）', () => {
    const r = recommend(profile({ daysPerWeek: 6, experience: 'year' }));
    expect(r.templateId).toBe('ppl');
    expect(r.days).toHaveLength(3);
    expect(r.perWeek).toBe(6);
    expect(r.perWeek).toBeGreaterThan(r.days.length);
  });
});

describe('recommend —— 按训练时长裁动作', () => {
  it('40 分钟：每天最多 4 个动作', () => {
    const r = recommend(profile({ minutes: 40 }));
    for (const d of r.days) expect(d.exercises.length).toBeLessThanOrEqual(4);
    expect(noteKinds(r)).toContain('trim');
  });

  it('裁掉的是排在后面的 —— 模板里复合动作在前、孤立在后', () => {
    const full = PROGRAMS.find((p) => p.id === 'ppl')!;
    const r = recommend(profile({ minutes: 40, daysPerWeek: 3 }));
    // 留下的必须是原列表的前缀，不能是随便挑的几个
    r.days.forEach((d, i) => {
      const original = full.days[i].exercises.map((e) => e.exerciseId);
      expect(d.exercises.map((e) => e.exerciseId)).toEqual(original.slice(0, d.exercises.length));
    });
  });

  it('再短也至少留 3 个动作 —— 裁到一两个就不是一次完整训练了', () => {
    for (const minutes of [40, 60, 90]) {
      for (const d of recommend(profile({ minutes })).days) {
        expect(d.exercises.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('90 分钟不动任何动作', () => {
    const full = PROGRAMS.find((p) => p.id === 'upper-lower')!;
    const r = recommend(profile({ minutes: 90, daysPerWeek: 4, experience: 'half' }));
    expect(r.days.map((d) => d.exercises.length)).toEqual(full.days.map((d) => d.exercises.length));
  });
});

describe('recommend —— 按目标调次数区间', () => {
  it('力量：只改每天第一个动作，其余和模板原样逐条一致', () => {
    const full = PROGRAMS.find((p) => p.id === 'ppl')!;
    const r = recommend(profile({ goal: 'strength', daysPerWeek: 3, minutes: 90 }));

    r.days.forEach((d, i) => {
      expect(d.exercises[0].repRange).toEqual([3, 5]); // 主项改成低次数
      // 其余动作必须一字不差地等于模板 —— 用「小于 10」这种阈值是拍脑袋，
      // 模板里本来就有 [12,15] 的孤立动作，阈值会把正确结果判成错的。
      expect(d.exercises.slice(1).map((e) => e.repRange)).toEqual(
        full.days[i].exercises.slice(1).map((e) => e.repRange),
      );
    });
    expect(noteKinds(r)).toContain('range');
  });

  it('增肌：次数区间原样不动', () => {
    const full = PROGRAMS.find((p) => p.id === 'ppl')!;
    const r = recommend(profile({ goal: 'muscle', daysPerWeek: 3, minutes: 90 }));
    expect(r.days.map((d) => d.exercises.map((e) => e.repRange))).toEqual(
      full.days.map((d) => d.exercises.map((e) => e.repRange)),
    );
  });

  it('任何情况下都会给出一条 range 说明 —— 使用者要知道次数区间动没动', () => {
    expect(noteKinds(recommend(profile({ goal: 'strength' })))).toContain('range');
    expect(noteKinds(recommend(profile({ goal: 'muscle' })))).toContain('range');
    expect(noteKinds(recommend(profile({ goal: 'tone' })))).toContain('range');
  });
});

describe('recommend —— 塑形 / 减脂：次数上移 + 有氧收尾', () => {
  const TONE_RANGES = [
    [10, 12],
    [15, 20],
  ];

  it('每个动作的次数区间都落在这两档里，没有漏网的', () => {
    for (const experience of ['new', 'half', 'year'] as Experience[]) {
      const r = recommend(profile({ goal: 'tone', experience, daysPerWeek: 3, minutes: 90 }));
      for (const d of r.days) {
        for (const e of d.exercises) {
          expect(TONE_RANGES, `动作 ${e.exerciseId} 的区间 ${e.repRange}`).toContainEqual(e.repRange);
        }
      }
    }
  });

  it('分档看的是模板自己的上限，不是「第一个动作就是复合动作」', () => {
    const full = PROGRAMS.find((p) => p.id === 'ppl')!;
    const r = recommend(profile({ goal: 'tone', daysPerWeek: 3, minutes: 90 }));

    r.days.forEach((d, i) => {
      const original = full.days[i].exercises;
      // 前 original.length 个是模板原班动作，最后一个是后加的有氧
      d.exercises.slice(0, original.length).forEach((e, j) => {
        const [lo, hi] = original[j].repRange;
        expect(e.exerciseId).toBe(original[j].exerciseId);
        expect(e.repRange).toEqual(hi <= 8 ? [10, 12] : [15, 20]);
        // 顺带钉死：区间是「上移」，不是原样保留
        expect(e.repRange[1]).toBeGreaterThanOrEqual(hi);
        expect(lo).toBeLessThanOrEqual(e.repRange[0]);
      });
    });
  });

  it('每个训练日末尾挂的就是名单里那一个，三个经验档各挑各的', () => {
    // 名单里的 id 是否真实存在、是不是「有氧 + 自重」，由 check:programs 校验
    // （和模板 id 走同一套）。这里只管推荐器有没有正确地把它们用起来。
    expect(CARDIO_FINISHERS).toHaveLength(3);
    expect(new Set(CARDIO_FINISHERS.map((f) => f.exerciseId)).size).toBe(3);

    for (const experience of ['new', 'half', 'year'] as Experience[]) {
      const f = CARDIO_FINISHERS.find((x) => x.experience === experience);
      expect(f, `名单里缺「${experience}」这一档`).toBeTruthy();

      const r = recommend(profile({ goal: 'tone', experience, daysPerWeek: 3, minutes: 90 }));
      for (const d of r.days) {
        expect(d.exercises[d.exercises.length - 1].exerciseId).toBe(f!.exerciseId);
      }
    }
  });

  it('有氧是加在裁动作之后的，不占「每次能练多久」的名额', () => {
    const r = recommend(profile({ goal: 'tone', daysPerWeek: 3, minutes: 40 }));
    // 40 分钟 → 模板动作裁到 4 个，再加 1 个有氧
    for (const d of r.days) expect(d.exercises.length).toBe(5);
  });

  it('增肌和力量没有有氧收尾 —— 只有塑形/减脂才有', () => {
    for (const goal of ['muscle', 'strength'] as Goal[]) {
      const r = recommend(profile({ goal, daysPerWeek: 3, minutes: 90 }));
      const full = PROGRAMS.find((p) => p.id === r.templateId)!;
      for (const [i, d] of r.days.entries()) {
        expect(d.exercises.length).toBe(full.days[i].exercises.length);
      }
    }
  });

  it('明说「这仍然是一份力量计划」，不让人以为拿到的是减脂课表', () => {
    const r = recommend(profile({ goal: 'tone' }));
    const warn = r.notes.find((n) => n.kind === 'warn');
    expect(warn?.text).toContain('仍然是一份力量计划');
  });
});

describe('recommend —— 每种组合都给出能用的结果', () => {
  const experiences: Experience[] = ['new', 'half', 'year'];
  const goals: Goal[] = ['muscle', 'strength', 'tone'];

  it('所有输入组合都不抛异常，且结果自洽', () => {
    for (const experience of experiences) {
      for (const daysPerWeek of [2, 3, 4, 5, 6]) {
        for (const minutes of [40, 60, 90]) {
          for (const goal of goals) {
            const r = recommend({ experience, daysPerWeek, minutes, goal });

            // 推荐的模板必须真的存在 —— 这里写成不存在的 id 会在界面上炸
            expect(PROGRAMS.some((p) => p.id === r.templateId)).toBe(true);
            expect(r.days.length).toBeGreaterThan(0);
            expect(r.perWeek).toBeGreaterThanOrEqual(2);
            expect(r.perWeek).toBeLessThanOrEqual(daysPerWeek);

            for (const d of r.days) {
              expect(d.exercises.length).toBeGreaterThanOrEqual(3);
              for (const e of d.exercises) {
                expect(e.sets).toBeGreaterThan(0);
                expect(e.repRange[0]).toBeLessThanOrEqual(e.repRange[1]);
              }
            }
            expect(r.notes.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('增肌/力量不改动作本身 —— 只挑模板、裁数量、调次数，不动「练哪些动作」', () => {
    // 塑形/减脂是这条规矩的**唯一例外**（末尾加一个自重有氧），单独在上面一组测试里守着
    for (const goal of ['muscle', 'strength'] as Goal[]) {
      const r = recommend(profile({ goal, daysPerWeek: 3, minutes: 90 }));
      const full = PROGRAMS.find((p) => p.id === 'ppl')!;
      expect(r.days.map((d) => d.exercises.map((e) => e.exerciseId))).toEqual(
        full.days.map((d) => d.exercises.map((e) => e.exerciseId)),
      );
    }
  });
});
