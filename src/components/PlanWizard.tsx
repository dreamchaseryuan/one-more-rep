import { useMemo, useState } from 'react';
import {
  profileText,
  recommend,
  type Experience,
  type Goal,
  type Profile,
  type Recommendation,
} from '../lib/recommend';

interface Props {
  onCancel: () => void;
  /** summary 是使用者选的条件的摘要，会存进计划的 desc */
  onCreate: (rec: Recommendation, summary: string) => void;
}

const EXPERIENCE: { value: Experience; label: string }[] = [
  { value: 'new', label: '刚开始练' },
  { value: 'half', label: '半年到一年' },
  { value: 'year', label: '一年往上' },
];

const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [40, 60, 90];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'muscle', label: '增肌为主' },
  { value: 'strength', label: '力量为主' },
];

export function PlanWizard({ onCancel, onCreate }: Props) {
  const [profile, setProfile] = useState<Profile>({
    experience: 'half',
    daysPerWeek: 3,
    minutes: 60,
    goal: 'muscle',
  });

  // 每改一项就重算。计算是纯函数、量也小，所以做成立即预览 ——
  // 使用者在按下「创建」之前就能看见会得到什么、以及为什么。
  const rec = useMemo(() => recommend(profile), [profile]);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  return (
    <section className="program">
      <header className="program-head">
        <h2 className="history-title">按你的情况推荐</h2>
        <button className="btn-text" onClick={onCancel}>
          返回
        </button>
      </header>

      <p className="hint">
        这里<strong>不会</strong>替你编一套计划。它只做三件事：从已有的模板里挑一个、
        按你能练的天数和时长裁掉多余的、按目标调次数区间。每一处改动都会列在下面 ——
        创建之后在编辑器里随时能改回去。
      </p>

      <div className="wizard-field">
        <span className="wizard-label">训练经验</span>
        <div className="chips">
          {EXPERIENCE.map((o) => (
            <button
              key={o.value}
              className={`chip ${profile.experience === o.value ? 'chip-on' : ''}`}
              onClick={() => set('experience', o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-field">
        <span className="wizard-label">一周能来几天</span>
        <div className="chips">
          {DAYS.map((d) => (
            <button
              key={d}
              className={`chip ${profile.daysPerWeek === d ? 'chip-on' : ''}`}
              onClick={() => set('daysPerWeek', d)}
            >
              {d} 天
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-field">
        <span className="wizard-label">每次大概练多久</span>
        <div className="chips">
          {MINUTES.map((m) => (
            <button
              key={m}
              className={`chip ${profile.minutes === m ? 'chip-on' : ''}`}
              onClick={() => set('minutes', m)}
            >
              {m} 分钟
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-field">
        <span className="wizard-label">主要目标</span>
        <div className="chips">
          {GOALS.map((o) => (
            <button
              key={o.value}
              className={`chip ${profile.goal === o.value ? 'chip-on' : ''}`}
              onClick={() => set('goal', o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wizard-result">
        <div className="wizard-result-head">
          <strong>{rec.name}</strong>
          <span className="wizard-result-meta">
            一周练 {rec.perWeek} 次 · {rec.days.length} 个训练日 ·{' '}
            {rec.days.reduce((n, d) => n + d.exercises.length, 0)} 个动作
          </span>
        </div>

        <ol className="wizard-notes">
          {rec.notes.map((n, i) => (
            <li key={i} className={`wizard-note wizard-note-${n.kind}`}>
              {n.text}
            </li>
          ))}
        </ol>

        <div className="wizard-days">
          {rec.days.map((d) => (
            <div className="wizard-day" key={d.name}>
              <span className="wizard-day-name">{d.name}</span>
              <span className="wizard-day-count">{d.exercises.length} 个动作</span>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary btn-block" onClick={() => onCreate(rec, profileText(profile))}>
        创建这份计划
      </button>
    </section>
  );
}
