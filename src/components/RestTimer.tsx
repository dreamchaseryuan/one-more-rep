import { useEffect, useRef, useState } from 'react';
import { chime } from '../lib/alert';

const DURATIONS = [60, 90, 120, 180];

interface Props {
  /** 每变一次就重新开始计时（打勾一组就 +1） */
  runId: number;
  duration: number;
  onDurationChange: (s: number) => void;
  onDismiss: () => void;
}

export function RestTimer({ runId, duration, onDurationChange, onDismiss }: Props) {
  const [endAt, setEndAt] = useState(() => Date.now() + duration * 1000);
  const [now, setNow] = useState(() => Date.now());
  const beeped = useRef(false);

  useEffect(() => {
    setEndAt(Date.now() + duration * 1000);
    setNow(Date.now());
    beeped.current = false;
  }, [runId, duration]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.ceil((endAt - now) / 1000));
  const total = duration;
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;

  useEffect(() => {
    if (left === 0 && !beeped.current) {
      beeped.current = true;
      chime();
    }
  }, [left]);

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <div className={`rest ${left === 0 ? 'rest-done' : ''}`}>
      <div className="rest-fill" style={{ width: `${pct}%` }} />
      <div className="rest-body">
        <span className="rest-label">{left === 0 ? '休息结束' : '休息中'}</span>
        <strong className="rest-time">{mmss}</strong>

        <div className="rest-controls">
          {DURATIONS.map((d) => (
            <button
              key={d}
              className={`rest-chip ${d === duration ? 'rest-chip-on' : ''}`}
              onClick={() => onDurationChange(d)}
              title={`默认休息 ${d} 秒`}
            >
              {d}s
            </button>
          ))}
          <button
            className="rest-chip"
            onClick={() => setEndAt((t) => t + 15000)}
            title="延长 15 秒"
          >
            +15s
          </button>
          <button className="rest-chip rest-skip" onClick={onDismiss}>
            跳过
          </button>
        </div>
      </div>
    </div>
  );
}
