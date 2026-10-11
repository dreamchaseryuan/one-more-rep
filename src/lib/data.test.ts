import { describe, expect, it } from 'vitest';
import { hasLocalMedia, mediaUrl, type Dataset } from './data';

const dataset = (files: string[]) => ({ mediaFiles: new Set(files) }) as unknown as Dataset;

describe('mediaUrl —— 没有兜底了', () => {
  it('本地有时返回本机路径', () => {
    const url = mediaUrl(dataset(['images/a.jpg']), 'images/a.jpg');
    expect(url).toContain('media/images/a.jpg');
  });

  it('本地没有时返回 null，而不是一个第三方地址', () => {
    // 这里原来是回退到 raw.githubusercontent.com。那个域名国内基本不通，
    // 注释却写着「保证任何情况下都有图」—— 实际是「任何情况下都挂在那儿等超时」。
    // 而且该 URL 不含 /media/ 段，匹配不上 workbox 的缓存规则，永远不会被缓存。
    expect(mediaUrl(dataset([]), 'images/a.jpg')).toBeNull();
  });

  it('任何情况下都不返回外部绝对地址', () => {
    // 这条是这次改动的核心不变量。mediaFiles 为空 = 开发时没跑 media:fetch，
    // 或 CI 拉媒体时部分失败 —— 两种情况下都必须留在本机，不能悄悄把请求发给别人。
    for (const files of [[], ['images/a.jpg'], ['videos/a.gif'], ['images/a.jpg', 'videos/a.gif']]) {
      for (const rel of ['images/a.jpg', 'videos/a.gif', 'images/不存在.jpg']) {
        const url = mediaUrl(dataset(files), rel);
        if (url !== null) {
          expect(url).not.toMatch(/^[a-z]+:\/\//i);
          expect(url).not.toContain('githubusercontent');
        }
      }
    }
  });
});

describe('hasLocalMedia', () => {
  it('和 mediaUrl 的判断一致 —— 一个管「有没有」，一个管「在哪」', () => {
    const d = dataset(['images/a.jpg', 'videos/b.gif']);
    for (const rel of ['images/a.jpg', 'videos/b.gif', 'images/c.jpg', '']) {
      expect(hasLocalMedia(d, rel)).toBe(mediaUrl(d, rel) !== null);
    }
  });
});
