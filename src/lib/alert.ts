/**
 * 计时结束的提示：声音 + 震动。
 *
 * **iOS 的坑**：`AudioContext` 必须在**用户手势中**创建或 `resume()`，否则它一直停在
 * `suspended`，`osc.start()` 不报错、也**不出声**。
 *
 * 原来的写法是在计时归零那一刻现建一个 context 再关掉 —— 而那一刻是 `setInterval`
 * 触发的，不是手势，所以在 iPhone 上大概率一直是静音的。这种失败形态最难查：
 * 没有报错、没有日志，只是你以为它会响。
 *
 * 所以改成：应用启动时挂一个一次性的 `pointerdown`，把使用者在本应用里的**第一次触摸**
 * 拿来创建并解锁一个常驻 context，之后所有提示音复用它。不需要各个组件自己记得解锁。
 */

let ctx: AudioContext | null = null;

type AudioCtor = typeof AudioContext;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** 在用户手势里调用。重复调用无副作用。 */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

/**
 * 应用启动时调用一次。
 *
 * `capture` 是为了抢在任何 `stopPropagation` 的处理器之前拿到这次触摸 ——
 * 解锁只有「这一次」机会（`once` 用完就摘），被别人的事件处理打断就白搭。
 */
export function installAudioUnlock() {
  window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
}

/**
 * 震动。
 *
 * 健身房比铃声可靠得多：手机常年静音档，环境又吵，提示音基本听不见。
 * 但注意 **iOS Safari 不支持 `navigator.vibrate`**，这条只在安卓上生效 ——
 * iPhone 上唯一的信号仍然是声音，所以上面那个解锁必须做对。
 */
function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // 不支持就算了
  }
}

/** 叮一声 + 震两下。计时结束用。 */
export function chime() {
  vibrate([200, 100, 200]);

  const c = getCtx();
  // 没解锁就别假装响了 —— 静默失败正是这个模块要消灭的东西。
  // 唯一会走到这里的正常情况：使用者从打开页面到计时结束一次屏幕都没碰过。
  if (!c || c.state !== 'running') return;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.09, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.5);
  // 注意：不 close()。这个 context 是常驻的，关掉下次又得重新等一次手势解锁。
}
