import { useState } from 'react';
import { mediaUrl, type Dataset } from '../lib/data';
import type { IndexedExercise } from '../types';

interface Props {
  exercise: IndexedExercise;
  dataset: Dataset;
  favorite: boolean;
  /** 已标记为伤病禁忌。仍然显示、仍然能点开——只是标出来。 */
  blocked: boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (e: IndexedExercise) => void;
}

export function ExerciseCard({ exercise, dataset, favorite, blocked, onToggleFavorite, onOpen }: Props) {
  const src = mediaUrl(dataset, exercise.image);
  // 两种情况都会落到「无图」：本机根本没有这张图（没跑 media:fetch），
  // 或者有但此刻取不到（离线、弱网）—— 后者在健身房是常态。
  // 没有兜底域名可退，所以这里必须自己画出来。
  const [broken, setBroken] = useState(false);

  return (
    <article className="card" onClick={() => onOpen(exercise)}>
      <div className="card-media">
        {src !== null && !broken ? (
          <img
            src={src}
            alt={exercise.nameZh}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="media-missing" title="这张图本机没有，或此刻取不到">
            无图
          </div>
        )}
        {blocked && <span className="card-contra" title="已标记为伤病禁忌">伤病禁忌</span>}
        <button
          className={`fav ${favorite ? 'fav-on' : ''}`}
          title={favorite ? '取消收藏' : '收藏'}
          onClick={(ev) => {
            ev.stopPropagation();
            onToggleFavorite(exercise.id);
          }}
        >
          {favorite ? '★' : '☆'}
        </button>
      </div>
      <div className="card-body">
        <h3 className="card-title">{exercise.nameZh}</h3>
        <p className="card-sub">{exercise.name}</p>
        <div className="card-tags">
          <span className="tag tag-target">{exercise.targetZh}</span>
          <span className="tag">{exercise.equipmentZh}</span>
        </div>
      </div>
    </article>
  );
}
