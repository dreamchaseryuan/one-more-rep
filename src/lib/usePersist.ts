import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * 把状态写进 localStorage，但**延迟到停手之后**再写。
 *
 * ## 为什么非做不可
 *
 * 训练记录是**全量**序列化的 —— 改一个重量数字，要把整份历史（几千个 set）重新
 * `JSON.stringify` 一遍再同步写进 localStorage。而且它在输入框的每次按键上都会跑。
 *
 * 实测（一份「练了一年」的数据：156 次训练、3120 个组、263 KB）：
 *
 * |            | 桌面 Chrome | 6× 降频（≈中端手机） |
 * |------------|------------|--------------------|
 * | stringify  | 0.49 ms    | 10.83 ms           |
 * | setItem    | 0.99 ms    | 6.35 ms            |
 * | 每次按键    | 1.48 ms    | **17.18 ms**       |
 *
 * 17 ms 已经超过一帧（16.7 ms）。也就是说手机上在重量框里敲「62.5」，四个字符就是
 * 约 69 ms 的阻塞 —— 掉帧是必然的，手感发黏。桌面上察觉不到，所以这个问题
 * **只在手机上存在**，而手机正是主要使用场景。
 *
 * ## 为什么序列化也要推迟
 *
 * 大头是 stringify（10.8 ms vs 6.4 ms）。所以这里存的是**值的引用**，序列化推迟到
 * 落盘那一刻 —— 否则每次按键仍然要 stringify 一遍，只省了写盘，等于白做。
 *
 * ## 延迟的代价，以及为什么必须 flush
 *
 * 延迟意味着「最后一次改动可能还没落盘」。移动端切后台、被系统回收是常态，
 * 所以 `visibilitychange` 和 `pagehide` 上必须立刻补写 —— 否则丢的正是**你刚练完的那几组**，
 * 比卡顿严重得多。
 *
 * 用 `pagehide` 而不是 `beforeunload`：后者在移动端（尤其 iOS Safari）经常不触发。
 */

/** 停手多久之后落盘。够短，正常打字不会攒太多；够长，一次能写完一串字符 */
const DELAY_MS = 300;

type Timer = ReturnType<typeof setTimeout>;

export interface WriteScheduler {
  /** 有改动：重置计时，停手后再落盘 */
  schedule(): void;
  /** 立刻落盘。没有待写内容时是空操作 —— 所以重复调用是安全的 */
  flush(): void;
  /** 丢弃待写内容（目前没用到，留给需要「放弃改动」的场景） */
  cancel(): void;
}

/**
 * 延迟落盘的调度器。**与 React 无关**，所以可以直接单测 ——
 * 而「合并多次改动」和「能立刻 flush」正是丢数据风险所在，必须能测。
 */
export function createWriteScheduler(write: () => void, delayMs: number = DELAY_MS): WriteScheduler {
  let timer: Timer | null = null;
  let pending = false;

  const stopTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    schedule() {
      pending = true;
      stopTimer(); // 连续改动合并成一次写
      timer = setTimeout(() => {
        timer = null;
        if (!pending) return;
        pending = false;
        write();
      }, delayMs);
    },
    flush() {
      stopTimer();
      if (!pending) return;
      pending = false;
      write();
    },
    cancel() {
      stopTimer();
      pending = false;
    },
  };
}

/**
 * 用法与原来那句 `useEffect(() => localStorage.setItem(...), [value])` 等价，
 * 只是不再每次都写。
 *
 * 注意：**落盘的是最后一次渲染的值**。所有读 localStorage 的地方都只在挂载时读，
 * 之后一律读 React state，所以不存在「状态和存储不一致」的问题。
 */
export function usePersist(key: string, value: unknown, delayMs: number = DELAY_MS) {
  const latest = useRef(value);

  const write = useCallback(() => {
    try {
      localStorage.setItem(key, JSON.stringify(latest.current));
    } catch (e) {
      // 配额满、或 Safari 隐私模式禁用存储。
      // 以前写在 useEffect 里，抛出去会让 React 卸载整棵树（白屏）；
      // 现在写在定时器里，不接管它就是一个静默的 uncaught error。
      // 两种都不好，所以在这里明确接住并留下痕迹。
      console.warn(`[persist] 写入 ${key} 失败，这次改动没有落盘`, e);
    }
  }, [key]);

  const scheduler = useMemo(() => createWriteScheduler(write, delayMs), [write, delayMs]);

  useEffect(() => {
    // 引用更新和「安排落盘」放在同一个 effect 里，避免在渲染期间写 ref
    latest.current = value;
    scheduler.schedule();
  }, [value, scheduler]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') scheduler.flush();
    };
    window.addEventListener('pagehide', scheduler.flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', scheduler.flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // 组件卸载（切标签页把面板卸掉、热更新）也要补写
      scheduler.flush();
    };
  }, [scheduler]);
}
