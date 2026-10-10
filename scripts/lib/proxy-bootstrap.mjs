import { spawnSync } from 'node:child_process';

/**
 * Node 的 fetch 默认不读 HTTP_PROXY / HTTPS_PROXY，直连 GitHub 会静默失败。
 * 检测到代理且开关未开时，带上 NODE_USE_ENV_PROXY=1 重启自己一次（Node 24+ 支持）。
 * 在脚本顶部调用即可，调用后不会返回。
 */
export function ensureFetchProxy() {
  if (process.env.NODE_USE_ENV_PROXY) return;
  const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  if (!proxy) return;

  console.log(`检测到代理 ${proxy}，启用 fetch 代理支持…`);
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(r.status ?? 1);
}
