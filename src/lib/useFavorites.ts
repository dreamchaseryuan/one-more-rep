import { useCallback, useMemo, useState } from 'react';
import { usePersist } from './usePersist';

const KEY = 'fitness:favorites';

/** 收藏夹，存 localStorage。个人用不需要账号和同步。 */
export function useFavorites() {
  const [ids, setIds] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
    } catch {
      return new Set<string>();
    }
  });

  // 必须转成数组：JSON.stringify(new Set()) 得到的是 `{}`，收藏会被静默清空。
  //
  // useMemo 不是为了省这点计算，是为了 **identity 稳定** —— 每次渲染都新建数组的话，
  // usePersist 的依赖每次都变，无关的重渲染也会反复安排落盘。
  const list = useMemo(() => [...ids], [ids]);
  usePersist(KEY, list);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** 导入备份时用：并集，不覆盖已有的 */
  const merge = useCallback((more: string[]) => {
    setIds((prev) => new Set([...prev, ...more]));
  }, []);

  return { ids, toggle, merge };
}
