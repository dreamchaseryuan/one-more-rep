import type { IndexedExercise, WarmupItem } from '../types';

interface Props {
  items: WarmupItem[];
  byId: Map<string, IndexedExercise>;
  onOpenExercise: (e: IndexedExercise) => void;
}

/**
 * 热身清单。**两个地方都用它**：计划页（折起来）和训练中界面。
 *
 * 抽出来是因为同一个东西要出现在两处 —— 复制一份的话，改一处忘一处只是时间问题。
 * 它自己不含容器样式（`.warmup` / `.warmup-fold` 由调用方给），
 * 因为两边的外框不一样。
 */
export function WarmupList({ items, byId, onOpenExercise }: Props) {
  return (
    <ol className="warmup-list">
      {items.map((w, i) => {
        const ex = w.exerciseId ? byId.get(w.exerciseId) : undefined;
        return (
          <li key={i}>
            {ex ? (
              <button className="warmup-name" onClick={() => onOpenExercise(ex)}>
                {w.name}
              </button>
            ) : (
              // 动作库里没有的热身（开合跳、绕环、空杆活动）—— 那是健美动作库，不是热身库
              <span className="warmup-name warmup-name-plain">{w.name}</span>
            )}
            <span className="warmup-note">{w.note}</span>
          </li>
        );
      })}
    </ol>
  );
}
