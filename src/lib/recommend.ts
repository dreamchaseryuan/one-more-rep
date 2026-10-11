import { PROGRAMS, type ProgramDay } from './programs';

/**
 * 按使用者情况从已有模板里挑一份，并做几处客观调整。
 *
 * ## 这个模块**不做**什么
 *
 * 它**不生成**训练计划。它只在三件事上做决定，每一件都能被讲清楚、也都能在编辑器里改回去：
 *
 * 1. **挑哪个模板** —— 依据是一周能来几天和训练经验
 * 2. **裁掉多余的动作** —— 依据是每次能练多久
 * 3. **调次数区间** —— 依据是目标（力量 / 增肌）
 *
 * 动作**选择**（该练哪些动作、怎么排）一律沿用模板作者定的顺序，这里不碰。
 * 那属于教练知识，凭一份问卷猜出来的东西，使用者会信，而信错了比不给更糟 ——
 * 这是伤病禁忌模块立下的同一条规矩。
 *
 * 所以界面上要如实说明这是「挑选 + 裁剪」，不是「给你定制了一套计划」。
 */

export type Experience = 'new' | 'half' | 'year';
export type Goal = 'muscle' | 'strength';

export interface Profile {
  /** 训练经验 */
  experience: Experience;
  /** 一周**能**来几天（不代表该来几天，见下面的上限） */
  daysPerWeek: number;
  /** 每次大概能练多久（分钟） */
  minutes: number;
  /** 主要目标 */
  goal: Goal;
}

export type NoteKind = 'pick' | 'trim' | 'range' | 'warn';

export interface Note {
  kind: NoteKind;
  text: string;
}

export interface Recommendation {
  /** 用的是哪个模板 */
  templateId: string;
  /** 建议的计划名 */
  name: string;
  /** 处理过的训练日：裁剪过动作、可能调过次数区间 */
  days: ProgramDay[];
  /** 建议一周练几次。可能大于 days.length（模板循环跑两轮） */
  perWeek: number;
  /** 逐条说明改了什么、为什么。界面上要完整显示 —— 这是「可审查」的关键 */
  notes: Note[];
}

/**
 * 一周该练几天的上限，按训练经验。
 *
 * 这是这个模块里**最值钱的一条规则**：新手最容易犯的错是照着一周五六天排，
 * 然后坚持不下来、或者练成了「每次都留余力」。3 天练满比 5 天练两天就废强得多。
 */
const WEEKLY_CAP: Record<Experience, number> = { new: 3, half: 4, year: 6 };

const EXPERIENCE_LABEL: Record<Experience, string> = {
  new: '刚开始练',
  half: '练了半年到一年',
  year: '练了一年往上',
};

const GOAL_LABEL: Record<Goal, string> = { muscle: '增肌为主', strength: '力量为主' };

/** 每次能练多久 → 一天最多几个动作。不是硬科学，是个能讲明白的折算 */
const MAX_EXERCISES: Record<number, number> = { 40: 4, 60: 5, 90: 99 };

/** 力量目标时，每天第一个动作（主项）的次数区间 */
const STRENGTH_MAIN_RANGE: [number, number] = [3, 5];

function pickTemplate(experience: Experience, days: number): { id: string; why: string } {
  if (days <= 2) {
    return {
      id: 'upper-lower',
      why: '一周两天，只能上下肢各练一次 —— 取上下肢分化的 A 日（水平推拉 + 深蹲主导），覆盖面最划算。',
    };
  }
  if (days === 3) {
    return {
      id: 'ppl',
      why: '一周三天，推拉腿轮转最合适：动作覆盖最全，间隔也够恢复。',
    };
  }
  if (days === 4) {
    return experience === 'year'
      ? {
          id: 'four-way',
          why: '一周四天且练了一年往上 —— 四分化让每个部位单独一天，单部位容量最大。',
        }
      : {
          id: 'upper-lower',
          why: '一周四天，上下肢分化让每个部位一周练两次 —— 对还在涨阶段的训练者，频率比单次容量更值钱。',
        };
  }
  if (days === 5) {
    return {
      id: 'five-way',
      why: '一周五天，五分化每个部位单独一天，单部位容量最大。代价是每个部位一周只练一次。',
    };
  }
  return {
    id: 'ppl',
    why: '一周六天：用推拉腿跑两轮，正好每个部位一周两次，频率和恢复都合适。',
  };
}

export function recommend(profile: Profile): Recommendation {
  const notes: Note[] = [];

  // ── 1. 决定一周实际排几天 ──────────────────────────────
  const cap = WEEKLY_CAP[profile.experience];
  const perWeek = Math.min(profile.daysPerWeek, cap);
  if (perWeek < profile.daysPerWeek) {
    notes.push({
      kind: 'warn',
      text:
        `${EXPERIENCE_LABEL[profile.experience]}，先说能来 ${profile.daysPerWeek} 天，这里只给你排 ${perWeek} 天。` +
        `排满却坚持不下来，不如 ${perWeek} 天练满 —— 等这 ${perWeek} 天变成习惯，编辑器里加训练日很容易。`,
    });
  }

  // ── 2. 挑模板 ────────────────────────────────────────
  const { id, why } = pickTemplate(profile.experience, perWeek);
  const template = PROGRAMS.find((p) => p.id === id);
  if (!template) throw new Error(`模板 ${id} 不存在`);

  notes.push({ kind: 'pick', text: `用「${template.name}」：${why}` });

  // ── 3. 一周两天时只留 A 日 ─────────────────────────────
  let days = template.days;
  if (perWeek === 2 && days.length > 2) {
    days = days.slice(0, 2);
    notes.push({
      kind: 'trim',
      text: `只留前两个训练日（${days.map((d) => d.name).join('、')}），把 B 日去掉 —— 两天装不下四个训练日，留着只会让你每次都跳过。`,
    });
  }

  // ── 4. 按训练时长裁动作 ────────────────────────────────
  const maxExercises = MAX_EXERCISES[profile.minutes] ?? 99;
  const trimmed = days.map((d) => ({
    ...d,
    exercises: d.exercises.slice(0, Math.max(3, Math.min(maxExercises, d.exercises.length))),
  }));
  const dropped = days.reduce((n, d, i) => n + (d.exercises.length - trimmed[i].exercises.length), 0);
  if (dropped > 0) {
    notes.push({
      kind: 'trim',
      text:
        `每次 ${profile.minutes} 分钟 → 每个训练日最多留 ${maxExercises} 个动作，共去掉 ${dropped} 个。` +
        `去掉的都是排在最后的那些（模板里复合动作在前、孤立动作在后）——想练回来，在编辑器里加就行。`,
    });
  }

  // ── 5. 按目标调主项次数区间 ────────────────────────────
  const finalDays =
    profile.goal === 'strength'
      ? trimmed.map((d) => {
          if (!d.exercises.length) return d;
          // 只动第一个动作：主项走低次数，辅助动作保持原来的高次数
          const exercises = d.exercises.map((e, j) =>
            j === 0 ? { ...e, repRange: STRENGTH_MAIN_RANGE } : e,
          );
          return { ...d, exercises };
        })
      : trimmed;

  if (profile.goal === 'strength') {
    notes.push({
      kind: 'range',
      text:
        `目标偏力量 → 每个训练日的第一个动作（主项）次数区间改成 ${STRENGTH_MAIN_RANGE[0]}~${STRENGTH_MAIN_RANGE[1]} 次，` +
        `其余动作保持原样。只改主项是因为力量靠大重量低次数练，而辅助动作仍然需要较高的次数来积累容量。`,
    });
  } else {
    notes.push({
      kind: 'range',
      text: '目标偏增肌 → 次数区间沿用模板原样（复合动作 6~8，孤立动作 10~15），这个范围对增肌本来就合适。',
    });
  }

  return {
    templateId: id,
    name: `${template.name} · 定制`,
    days: finalDays,
    perWeek,
    notes,
  };
}

/** 界面上用来回显使用者的选择 */
export const profileText = (p: Profile) =>
  `${EXPERIENCE_LABEL[p.experience]} · 一周 ${p.daysPerWeek} 天 · 每次 ${p.minutes} 分钟 · ${GOAL_LABEL[p.goal]}`;
