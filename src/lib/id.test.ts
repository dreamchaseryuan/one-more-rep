import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './id';

/** RFC 4122 v4：版本位是 4，变体位是 8/9/a/b */
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const realCrypto = globalThis.crypto;

/**
 * 把 crypto 换成「只有 getRandomValues、没有 randomUUID」的样子。
 *
 * 参数写成 `Uint8Array<ArrayBuffer>` 而不是裸 `Uint8Array`：TS 5.7 起 Uint8Array 带了
 * buffer 类型参数，裸写法会推断成 `ArrayBufferLike`（含 SharedArrayBuffer），
 * 与 DOM 的 `getRandomValues` 签名对不上。
 */
function stubInsecureContextCrypto() {
  vi.stubGlobal('crypto', {
    getRandomValues: (a: Uint8Array<ArrayBuffer>) => realCrypto.getRandomValues(a),
  });
}

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('有 crypto.randomUUID 时直接用（线上 HTTPS / localhost 走这条）', () => {
    const spy = vi.fn(() => '11111111-2222-4333-8444-555555555555');
    vi.stubGlobal('crypto', { ...realCrypto, randomUUID: spy });

    expect(newId()).toBe('11111111-2222-4333-8444-555555555555');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('没有 randomUUID 时不抛异常（手机连局域网 IP 调试就是这个状态）', () => {
    // 这正是当初整页白屏的原因：randomUUID 是 undefined，调用抛 TypeError，
    // 而异常是在 setState 的更新函数里抛的 —— React 把整棵树卸载掉，页面变空白。
    // 所以「不抛异常」本身就是核心断言，format 只是其次。
    stubInsecureContextCrypto();
    expect(typeof globalThis.crypto.randomUUID).toBe('undefined');
    expect(() => newId()).not.toThrow();
  });

  it('兜底路径给出合法 v4 UUID（形状与 randomUUID 一致，旧数据读起来无差别）', () => {
    stubInsecureContextCrypto();
    expect(newId()).toMatch(V4);
  });

  it('兜底路径不重复', () => {
    stubInsecureContextCrypto();
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
  });

  it('两条路径产出的形状同样合法', () => {
    expect(newId()).toMatch(V4); // 原生
    stubInsecureContextCrypto();
    expect(newId()).toMatch(V4); // 兜底
  });
});
