/**
 * 生成一条新记录的 id。
 *
 * **不要直接写 `crypto.randomUUID()`** —— 它只在安全上下文里存在。
 * 手机连局域网 IP 调试时（`http://192.168.x.x:5173`）不是安全上下文，
 * `crypto.randomUUID` 是 `undefined`，调用会抛 TypeError，
 * 而且是在 setState 的更新函数里抛的 —— React 整棵树直接卸载，页面变空白。
 *
 * 注意这两个 API 的可用条件**不一样**：`crypto.getRandomValues` 不受安全上下文限制，
 * 所以局域网 HTTP 下有它、没 `randomUUID`。已实测：
 *
 *   localhost:5173        → isSecureContext true,  randomUUID function
 *   10.8.142.204:5174     → isSecureContext false, randomUUID undefined, getRandomValues function
 *
 * 低版本浏览器同理。所以统一走这里，别在业务代码里直接碰 `crypto.randomUUID`。
 *
 * 部署到 HTTPS 之后这条路径不会触发，但**开发期天天走**，不值得为它放弃局域网调试。
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  // 退路：手搓一个 RFC 4122 v4 UUID。形状和 randomUUID 一致，
  // 所以存进 localStorage 的旧数据和新数据读起来没有区别。
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // 版本 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
