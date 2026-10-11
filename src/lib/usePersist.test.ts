import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriteScheduler } from './usePersist';

/**
 * 这段逻辑承载的是「丢数据」的风险，所以测的重点不是「延迟生效了吗」，
 * 而是**合并**和 **flush 之后不会重复写、也不会漏写**。
 */
describe('createWriteScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('schedule 之后不会立刻写', () => {
    const write = vi.fn();
    const s = createWriteScheduler(write, 300);

    s.schedule();
    expect(write).not.toHaveBeenCalled();
  });

  it('过了延迟才写', () => {
    const write = vi.fn();
    const s = createWriteScheduler(write, 300);

    s.schedule();
    vi.advanceTimersByTime(299);
    expect(write).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledOnce();
  });

  it('连续改动合并成一次写 —— 这正是加它的理由', () => {
    const write = vi.fn();
    const s = createWriteScheduler(write, 300);

    // 模拟在重量框里敲「6」「2」「.」「5」：四次状态更新
    for (let i = 0; i < 4; i++) {
      s.schedule();
      vi.advanceTimersByTime(50);
    }
    expect(write).not.toHaveBeenCalled(); // 一直没停手，所以一次都没写

    vi.advanceTimersByTime(300);
    expect(write).toHaveBeenCalledOnce(); // 只写一次，而不是四次
  });

  it('flush 立刻写，不用等', () => {
    const write = vi.fn();
    const s = createWriteScheduler(write, 300);

    s.schedule();
    s.flush();
    expect(write).toHaveBeenCalledOnce();
  });

  it('flush 之后定时器到点不会重复写', () => {
    const write = vi.fn();
    const s = createWriteScheduler(write, 300);

    s.schedule();
    s.flush();
    vi.advanceTimersByTime(1000);

    expect(write).toHaveBeenCalledOnce(); // 不是两次
  });

  it('没有待写内容时 flush 是空操作 —— 页面隐藏事件会反复触发', () => {
    const write = vi.fn();
    const s = createWriteScheduler(write, 300);

    s.flush();
    s.flush();
    s.flush();
    expect(write).not.toHaveBeenCalled();
  });

  it('flush 之后又有新改动，仍然会写', () => {
    const write = vi.fn();
    const s = createWriteScheduler(write, 300);

    s.schedule();
    s.flush();
    s.schedule();
    vi.advanceTimersByTime(300);

    expect(write).toHaveBeenCalledTimes(2);
  });

  it('cancel 之后不再写', () => {
    const write = vi.fn();
    const s = createWriteScheduler(write, 300);

    s.schedule();
    s.cancel();
    vi.advanceTimersByTime(1000);

    expect(write).not.toHaveBeenCalled();
  });

  it('cancel 之后 flush 也不会写（已经丢弃了）', () => {
    const write = vi.fn();
    const s = createWriteScheduler(write, 300);

    s.schedule();
    s.cancel();
    s.flush();

    expect(write).not.toHaveBeenCalled();
  });
});
