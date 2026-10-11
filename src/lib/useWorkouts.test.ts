import { describe, expect, it } from 'vitest';
import { filledSetCount, isFilled, setVolume, workoutVolume } from './useWorkouts';
import type { SetEntry, Workout } from '../types';

const s = (p: Partial<SetEntry> = {}): SetEntry => ({ weight: '', reps: '', done: false, ...p });

const w = (...entries: { exerciseId: string; sets: SetEntry[] }[]): Workout => ({
  id: 'w1',
  date: '2026-10-11',
  entries,
});

/** 从计划开始训练时，组会被预填建议值 —— 但使用者一次都没碰过 */
const prefilled = (weight: string, reps: string): SetEntry => ({ weight, reps, done: false });

describe('isFilled —— 「预填」和「实际做了」的分界线', () => {
  it('全新空组不算做过', () => {
    expect(isFilled(s())).toBe(false);
  });

  it('计划预填但没碰过，不算做过', () => {
    // 这是这个项目最值钱的一条断言。
    // 第一版按「字段非空」判断，于是使用者根本没练的动作也进了历史
    // （因为次数被预填了），进而污染「上次成绩」和加重建议。
    // 错误的重量建议会直接导致练错 —— 而且没有任何报错。
    expect(isFilled(prefilled('60', '8'))).toBe(false);
    expect(isFilled(prefilled('60', ''))).toBe(false);
    expect(isFilled(prefilled('', '8'))).toBe(false);
  });

  it('打勾就算做过（预填的也算）', () => {
    expect(isFilled({ ...prefilled('60', '8'), done: true })).toBe(true);
  });

  it('自己填了重量或次数就算做过 —— 不用非得打勾', () => {
    expect(isFilled(prefilled('60', '8'))).toBe(false);
    expect(isFilled({ weight: '60', reps: '8', done: false, touched: true })).toBe(true);
    expect(isFilled({ weight: '60', reps: '', done: false, touched: true })).toBe(true);
    expect(isFilled({ weight: '', reps: '8', done: false, touched: true })).toBe(true);
  });

  it('碰过但清空了，不算做过', () => {
    expect(isFilled({ weight: '', reps: '', done: false, touched: true })).toBe(false);
  });
});

describe('filledSetCount —— 决定「结束训练」能不能点', () => {
  it('整天的预填组一组都不算', () => {
    expect(filledSetCount(w({ exerciseId: 'a', sets: [prefilled('60', '8'), prefilled('60', '8')] }))).toBe(0);
  });

  it('只数真正做过的那几组', () => {
    const workout = w(
      { exerciseId: 'a', sets: [prefilled('60', '8'), { ...prefilled('60', '8'), done: true }] },
      { exerciseId: 'b', sets: [prefilled('40', '10'), prefilled('40', '10'), prefilled('40', '10')] },
    );
    expect(filledSetCount(workout)).toBe(1);
  });

  it('没有任何记录时是 0 —— 界面据此禁用结束按钮', () => {
    expect(filledSetCount(w())).toBe(0);
  });
});

describe('setVolume', () => {
  it('重量 × 次数', () => {
    expect(setVolume(s({ weight: '60', reps: '8' }))).toBe(480);
    expect(setVolume(s({ weight: '62.5', reps: '5' }))).toBe(312.5);
  });

  it('自重动作（没填重量）按 0 计，不污染总容量', () => {
    expect(setVolume(s({ reps: '12' }))).toBe(0);
    expect(setVolume(s())).toBe(0);
  });

  it('只有重量没有次数也是 0', () => {
    expect(setVolume(s({ weight: '60' }))).toBe(0);
  });

  it('非法值不产生 NaN 或负数', () => {
    // 重量次数是用字符串存的，因为输入框允许半输入状态（刚敲了「6」还没敲完「60」）
    for (const bad of ['abc', '', '  ', '-5', '0']) {
      const v = setVolume(s({ weight: bad, reps: '8' }));
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('workoutVolume', () => {
  it('只统计实际做了的组 —— 否则预填重量会把容量虚高一大截', () => {
    const workout = w({
      exerciseId: 'a',
      sets: [prefilled('100', '10'), { weight: '60', reps: '8', done: true, touched: true }],
    });
    // 若把预填那组算进来会是 1000 + 480
    expect(workoutVolume(workout)).toBe(480);
  });

  it('多个动作相加', () => {
    const workout = w(
      { exerciseId: 'a', sets: [{ weight: '60', reps: '8', done: true, touched: true }] },
      { exerciseId: 'b', sets: [{ weight: '40', reps: '10', done: true, touched: true }] },
    );
    expect(workoutVolume(workout)).toBe(480 + 400);
  });

  it('没有任何实际记录时为 0', () => {
    expect(workoutVolume(w({ exerciseId: 'a', sets: [prefilled('60', '8')] }))).toBe(0);
  });
});
