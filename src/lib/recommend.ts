import { CARDIO_FINISHERS, PROGRAMS, type CardioFinisher, type ProgramDay } from './programs';

/**
 * 按使用者情况从已有模板里挑一份，并做几处客观调整。
 *
 * ## 这个模块**不做**什么
 *
 * 它**不生成**训练计划。它只在四件事上做决定，每一件都能被讲清楚、也都能在编辑器里改回去：
 *
 * 1. **挑哪个模板** —— 依据是一周能来几天和训练经验
 * 2. **裁掉多余的动作** —— 依据是每次能练多久
 * 3. **调次数区间** —— 依据是目标
 * 4. **给「塑形/减脂」在训练日末尾挂一个自重有氧收尾** —— 见 CARDIO_FINISHER
 *
 * 第 4 条是唯一一处本模块**替使用者挑动作**的地方，所以它有三重限制：
 * 只在 `tone` 目标下发生；挑的是不需要器械的动作（不必猜健身房有什么）；
 * 挑哪一个在 notes 里明说，并且提醒可以直接删。除此之外，
 * 动作**选择**（该练哪些动作、怎么排）一律沿用模板作者定的顺序，这里不碰。
 * 那属于教练知识，凭一份问卷猜出来的东西，使用者会信，而信错了比不给更糟 ——
 * 这是伤病禁忌模块立下的同一条规矩。
 *
 * 所以界面上要如实说明这是「挑选 + 裁剪」，不是「给你定制了一套计划」。
 */

export type Experience = 'new' | 'half' | 'year';

/**
 * 训练目标。三个都在 `recommend()` 第 5 步里有**真实且看得见**的后果：
 *
 * | 目标 | 次数区间 | 有氧收尾 |
 * |---|---|---|
 * | `muscle` 增肌 | 沿用模板原样 | 无 |
 * | `strength` 力量 | 主项降到 3~5 次 | 无 |
 * | `tone` 塑形/减脂 | 整体上移 | 每个训练日末尾加一个 |
 *
 * 加目标时请守住这条：**每个选项都必须改变输出**。选了什么都不变的选项是假按钮，
 * 和参考图里那个点不动的铃铛是同一类东西（见 README「刻意没做的」）。
 */
export type Goal = 'muscle' | 'strength' | 'tone';

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

const GOAL_LABEL: Record<Goal, string> = {
  muscle: '增肌为主',
  strength: '力量为主',
  tone: '塑形 / 减脂为主',
};

/** 每次能练多久 → 一天最多几个动作。不是硬科学，是个能讲明白的折算 */
const MAX_EXERCISES: Record<number, number> = { 40: 4, 60: 5, 90: 99 };

/** 力量目标时，每天第一个动作（主项）的次数区间 */
const STRENGTH_MAIN_RANGE: [number, number] = [3, 5];

/** 上限不超过这个数就算模板里「偏重的那几个复合动作」，塑形向只降一档而不是直接拉到高次数 */
const TONE_HEAVY_MAX = 8;
const TONE_HEAVY_RANGE: [number, number] = [10, 12];
const TONE_OTHER_RANGE: [number, number] = [15, 20];

/**
 * 塑形/减脂向在训练日末尾挂的自重有氧。
 *
 * **挑哪一个不在这里定** —— 名单和动作 id 在 data/programs.json 的 `cardioFinishers` 里，
 * 由 scripts/check-programs.mjs 和模板 id 一起校验（存在性、是不是「有氧 + 自重」）。
 * 这里只负责按经验取一条。
 */
const finisherFor = (experience: Experience): CardioFinisher | undefined =>
  CARDIO_FINISHERS.find((f) => f.experience === experience);

const CARDIO_FINISHER_SETS = 3;
const CARDIO_FINISHER_RANGE: [number, number] = [15, 20];

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

  // ── 5. 按目标调次数区间（塑形/减脂再挂一个有氧收尾）──────
  let finalDays = trimmed;

  if (profile.goal === 'strength') {
    finalDays = trimmed.map((d) => {
      if (!d.exercises.length) return d;
      // 只动第一个动作：主项走低次数，辅助动作保持原来的高次数
      const exercises = d.exercises.map((e, j) =>
        j === 0 ? { ...e, repRange: STRENGTH_MAIN_RANGE } : e,
      );
      return { ...d, exercises };
    });
    notes.push({
      kind: 'range',
      text:
        `目标偏力量 → 每个训练日的第一个动作（主项）次数区间改成 ${STRENGTH_MAIN_RANGE[0]}~${STRENGTH_MAIN_RANGE[1]} 次，` +
        `其余动作保持原样。只改主项是因为力量靠大重量低次数练，而辅助动作仍然需要较高的次数来积累容量。`,
    });
  } else if (profile.goal === 'tone') {
    const finisher = finisherFor(profile.experience);

    finalDays = trimmed.map((d) => {
      if (!d.exercises.length) return d;

      const exercises = d.exercises.map((e) => ({
        ...e,
        // 按**模板自己的**上限分档，而不是按下标猜哪个是复合动作 ——
        // 下标那套「复合在前」只是模板作者的排版习惯，不是能依赖的约定
        repRange: e.repRange[1] <= TONE_HEAVY_MAX ? TONE_HEAVY_RANGE : TONE_OTHER_RANGE,
      }));

      // 有氧加在裁动作**之后**，不占 maxExercises 的名额 —— 它是收尾，不是主项
      if (finisher && !exercises.some((e) => e.exerciseId === finisher.exerciseId)) {
        exercises.push({
          exerciseId: finisher.exerciseId,
          sets: CARDIO_FINISHER_SETS,
          repRange: CARDIO_FINISHER_RANGE,
        });
      }
      return { ...d, exercises };
    });

    notes.push({
      kind: 'range',
      text:
        `目标偏塑形/减脂 → 每个动作的次数区间上移：模板里上限不超过 ${TONE_HEAVY_MAX} 次的（偏重的那几个复合动作）` +
        `改成 ${TONE_HEAVY_RANGE[0]}~${TONE_HEAVY_RANGE[1]} 次，其余改成 ${TONE_OTHER_RANGE[0]}~${TONE_OTHER_RANGE[1]} 次。`,
    });

    if (finisher) {
      notes.push({
        kind: 'pick',
        text:
          `每个训练日末尾加一个自重有氧收尾：${finisher.why}，${CARDIO_FINISHER_SETS} 组 × ` +
          `${CARDIO_FINISHER_RANGE[0]}~${CARDIO_FINISHER_RANGE[1]} 次。挑的是自重的动作，` +
          `不需要器械，任何健身房都能做。不想要就在编辑器里删掉，或者换成别的。`,
      });
    } else {
      // 名单在 data/programs.json 里被改坏时会走到这里（check:programs 本该先拦下来）。
      // 与其安静地少一段，不如说出来 —— 「静默地给少了」是这个项目一贯要避免的。
      notes.push({
        kind: 'warn',
        text: `有氧收尾没加上：data/programs.json 里找不到「${profile.experience}」这一档的动作，只调了次数区间。`,
      });
    }

    notes.push({
      kind: 'warn',
      // 这句必须留着。选「塑形/减脂」的人期待的是另一类课程，
      // 而这里给的是力量计划 —— 不写清楚，前两条 note 会让人以为这是一份减脂课表。
      text:
        '但要说清楚：这仍然是一份力量计划，只是次数上移、结尾加了一段有氧。' +
        '库里的 1324 个动作有 1295 个是按肌群切的力量动作，凑不出真正的有氧或减脂课程 —— 那需要另一套动作库。',
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
