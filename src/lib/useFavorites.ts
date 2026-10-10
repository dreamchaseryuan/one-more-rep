import { useCallback, useEffect, useState } from 'react';

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

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  }, [ids]);

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
