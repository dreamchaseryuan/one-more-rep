import { useEffect, useState } from 'react';
import { hasLocalMedia, mediaUrl, type Dataset } from '../lib/data';
import type { ContraindicationStore } from '../lib/useContraindications';
import type { IndexedExercise } from '../types';

interface Props {
  exercise: IndexedExercise;
  dataset: Dataset;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onSelect: (e: IndexedExercise) => void;
  /** 加入今日训练（若还没有进行中的训练，会先开始一次） */
  onAddToWorkout: (id: string) => void;
  inWorkout: boolean;
  /** 是否已有进行中的训练，用于按钮措辞 */
  activeWorkout: boolean;
  contraStore: ContraindicationStore;
}

export function DetailPanel({
  exercise,
  dataset,
  favorite,
  onToggleFavorite,
  onClose,
  onSelect,
  onAddToWorkout,
  inWorkout,
  activeWorkout,
  contraStore,
}: Props) {
  const [marking, setMarking] = useState(false);
  const contra = contraStore.get(exercise.id);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 本地下过 GIF 就演示动画，否则退回静态缩略图
  const showGif = hasLocalMedia(dataset, exercise.gif);
  const src = mediaUrl(dataset, showGif ? exercise.gif : exercise.image);

  const related = dataset.exercises
    .filter((e) => e.id !== exercise.id && e.target === exercise.target)
    .slice(0, 6);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(ev) => ev.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <h2>{exercise.nameZh}</h2>
            <p className="drawer-sub">{exercise.name}</p>
          </div>
          <div className="drawer-actions">
            <button
              className={`fav fav-lg ${favorite ? 'fav-on' : ''}`}
              onClick={() => onToggleFavorite(exercise.id)}
              title={favorite ? '取消收藏' : '收藏'}
            >
              {favorite ? '★' : '☆'}
            </button>
            <button className="btn-close" onClick={onClose} title="关闭">
              ✕
            </button>
          </div>
        </header>

        <div className="drawer-media">
          <img src={src} alt={exercise.nameZh} />
          {!showGif && <span className="media-note">静态图 · 动画需下载 GIF</span>}
        </div>

        <button
          className={`btn-primary btn-block ${inWorkout ? 'btn-done' : ''}`}
          onClick={() => onAddToWorkout(exercise.id)}
          disabled={inWorkout}
        >
          {inWorkout ? '✓ 已在今日训练中' : activeWorkout ? '+ 加入今日训练' : '+ 开始训练并加入'}
        </button>

        {contra ? (
          <div className="contra-marked">
            <span>
              已标记为伤病禁忌
              {contra.until && ` · 预计 ${contra.until.slice(5)} 恢复`}
              {contra.note && ` · ${contra.note}`}
            </span>
            <button className="btn-text" onClick={() => contraStore.unmark(exercise.id)}>
              解除
            </button>
          </div>
        ) : marking ? (
          <div className="contra-form">
            <label className="editor-field">
              预计恢复
              <input className="editor-day-focus" type="date" id="contra-until" />
            </label>
            <input className="editor-day-focus" id="contra-note" placeholder="备注（例：右肩冈上肌）" />
            <div className="contra-form-actions">
              <button
                className="btn-primary"
                onClick={() => {
                  const until = (document.getElementById('contra-until') as HTMLInputElement)?.value;
                  const note = (document.getElementById('contra-note') as HTMLInputElement)?.value.trim();
                  contraStore.mark(exercise.id, {
                    ...(until ? { until } : {}),
                    ...(note ? { note } : {}),
                  });
                  setMarking(false);
                }}
              >
                确认标记
              </button>
              <button className="btn-text" onClick={() => setMarking(false)}>
                取消
              </button>
            </div>
            <p className="hint">
              到期不会自动解除，只会提醒你确认——否则会在你没注意时把受伤动作塞回计划。
            </p>
          </div>
        ) : (
          <button className="btn-ghost btn-block" onClick={() => setMarking(true)}>
            标记为伤病禁忌
          </button>
        )}

        <dl className="meta">
          <div>
            <dt>目标肌</dt>
            <dd>{exercise.targetZh}</dd>
          </div>
          <div>
            <dt>部位</dt>
            <dd>{exercise.bodyPartZh}</dd>
          </div>
          <div>
            <dt>器械</dt>
            <dd>{exercise.equipmentZh}</dd>
          </div>
          {exercise.secondaryMusclesZh.length > 0 && (
            <div>
              <dt>协同肌</dt>
              <dd>{exercise.secondaryMusclesZh.join('、')}</dd>
            </div>
          )}
        </dl>

        <section className="steps">
          <h3>动作步骤</h3>
          <ol>
            {exercise.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>

        {related.length > 0 && (
          <section className="related">
            <h3>同类动作</h3>
            <div className="related-list">
              {related.map((e) => (
                <button key={e.id} className="related-item" onClick={() => onSelect(e)}>
                  {e.nameZh}
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="drawer-foot">演示媒体 {exercise.attribution}</footer>
      </aside>
    </div>
  );
}
