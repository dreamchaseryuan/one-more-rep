import { mediaUrl, type Dataset } from '../lib/data';
import type { IndexedExercise } from '../types';

interface Props {
  exercise: IndexedExercise;
  dataset: Dataset;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (e: IndexedExercise) => void;
}

export function ExerciseCard({ exercise, dataset, favorite, onToggleFavorite, onOpen }: Props) {
  return (
    <article className="card" onClick={() => onOpen(exercise)}>
      <div className="card-media">
        <img src={mediaUrl(dataset, exercise.image)} alt={exercise.nameZh} loading="lazy" decoding="async" />
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
