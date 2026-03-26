export type SectionKey = "religious" | "study" | "career" | "health" | "personal";

export type ReligiousState = {
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
  adhkarMorning: boolean;
  adhkarEvening: boolean;
  quranPages: number;
  quranTarget: number;
};

export type StudyState = {
  focusSessions: number;
  focusTarget: number;
  lecturesReviewed: boolean;
  assignmentProgress: number;
};

export type CareerState = {
  skillMinutes: number;
  skillTarget: number;
  portfolioStep: boolean;
  networkingStep: boolean;
};

export type HealthState = {
  waterCups: number;
  waterTarget: number;
  workoutDone: boolean;
  sleepHours: number;
  sleepTarget: number;
};

export type PersonalState = {
  familyCheck: boolean;
  roomReset: boolean;
  tomorrowPlan: boolean;
};

export type LifeData = {
  religious: ReligiousState;
  study: StudyState;
  career: CareerState;
  health: HealthState;
  personal: PersonalState;
};

export type DailyChallenge = {
  title: string;
  tip: string;
  actionText: string;
  targetSection: SectionKey;
};

export type SectionMeta = {
  id: SectionKey;
  label: string;
  description: string;
};

export type WorkspaceAnalytics = {
  challengeStarts: number;
  challengeCompletions: number;
  sectionOpens: Record<SectionKey, number>;
  challengeCompletionsBySection: Record<SectionKey, number>;
};

export type WorkspaceStorage = {
  schemaVersion: number;
  lastUpdatedDay: string;
  lifeData: LifeData;
  analytics: WorkspaceAnalytics;
};

export const WORKSPACE_STORAGE_KEY = "nizam-hayati/data";
export const LEGACY_LIFE_DATA_KEY = "nizam-hayati/v4/life-data";
export const LEGACY_LIFE_DAY_KEY = "nizam-hayati/v4/day";
export const WORKSPACE_SCHEMA_VERSION = 1;

export const SECTION_META: SectionMeta[] = [
  { id: "religious", label: "حياتي الدينية", description: "صلاة، ورد، وأذكار" },
  { id: "study", label: "حياتي الدراسية", description: "جلسات وتركيز ومراجعة" },
  { id: "career", label: "حياتي المهنية", description: "مهارة وخطوة مهنية يومية" },
  { id: "health", label: "حياتي الصحية", description: "ماء، نوم، وحركة" },
  { id: "personal", label: "حياتي الشخصية", description: "اتزان وتنظيم يومي" },
];

export const DAILY_CHALLENGES: DailyChallenge[] = [
  {
    title: "تحدي اليوم: بداية بدون مماطلة",
    tip: "ابدأ بـ 20 دقيقة فقط في القسم الدراسي قبل فتح أي سوشيال.",
    actionText: "ابدأ الآن في حياتي الدراسية",
    targetSection: "study",
  },
  {
    title: "تحدي اليوم: إنعاش الدماغ",
    tip: "10 دقائق حركة + كوبين ماء خلال أول ساعة نشاط.",
    actionText: "نفّذ في حياتي الصحية",
    targetSection: "health",
  },
  {
    title: "تحدي اليوم: تثبيت الأساس",
    tip: "صلاتان في وقتهما + صفحة قرآن واحدة قبل نهاية اليوم.",
    actionText: "ادخل حياتي الدينية",
    targetSection: "religious",
  },
  {
    title: "تحدي اليوم: خطوة مهنية صغيرة",
    tip: "30 دقيقة تطوير مهارة أو تعديل واحد في البورتفوليو.",
    actionText: "اشتغل على حياتي المهنية",
    targetSection: "career",
  },
  {
    title: "تحدي اليوم: إغلاق اليوم صح",
    tip: "رتب مكانك 5 دقائق ثم اكتب خطة الغد في آخر اليوم.",
    actionText: "ابدأ من حياتي الشخصية",
    targetSection: "personal",
  },
];

export function createDefaultLifeData(): LifeData {
  return {
    religious: {
      fajr: false,
      dhuhr: false,
      asr: false,
      maghrib: false,
      isha: false,
      adhkarMorning: false,
      adhkarEvening: false,
      quranPages: 0,
      quranTarget: 4,
    },
    study: {
      focusSessions: 0,
      focusTarget: 3,
      lecturesReviewed: false,
      assignmentProgress: 0,
    },
    career: {
      skillMinutes: 0,
      skillTarget: 60,
      portfolioStep: false,
      networkingStep: false,
    },
    health: {
      waterCups: 0,
      waterTarget: 8,
      workoutDone: false,
      sleepHours: 0,
      sleepTarget: 7,
    },
    personal: {
      familyCheck: false,
      roomReset: false,
      tomorrowPlan: false,
    },
  };
}

export function createDefaultAnalytics(): WorkspaceAnalytics {
  return {
    challengeStarts: 0,
    challengeCompletions: 0,
    sectionOpens: {
      religious: 0,
      study: 0,
      career: 0,
      health: 0,
      personal: 0,
    },
    challengeCompletionsBySection: {
      religious: 0,
      study: 0,
      career: 0,
      health: 0,
      personal: 0,
    },
  };
}

export function createDefaultWorkspaceStorage(today: string): WorkspaceStorage {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    lastUpdatedDay: today,
    lifeData: createDefaultLifeData(),
    analytics: createDefaultAnalytics(),
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function sectionProgress(section: SectionKey, data: LifeData): number {
  if (section === "religious") {
    const r = data.religious;
    const fixedDone = [r.fajr, r.dhuhr, r.asr, r.maghrib, r.isha, r.adhkarMorning, r.adhkarEvening].filter(Boolean).length;
    const quranPart = clamp(r.quranPages / r.quranTarget, 0, 1);
    return Math.round(((fixedDone + quranPart) / 8) * 100);
  }

  if (section === "study") {
    const s = data.study;
    const sessionPart = clamp(s.focusSessions / s.focusTarget, 0, 1);
    const lecturesPart = s.lecturesReviewed ? 1 : 0;
    const assignmentPart = clamp(s.assignmentProgress / 100, 0, 1);
    return Math.round(((sessionPart + lecturesPart + assignmentPart) / 3) * 100);
  }

  if (section === "career") {
    const c = data.career;
    const minutesPart = clamp(c.skillMinutes / c.skillTarget, 0, 1);
    const portfolioPart = c.portfolioStep ? 1 : 0;
    const networkingPart = c.networkingStep ? 1 : 0;
    return Math.round(((minutesPart + portfolioPart + networkingPart) / 3) * 100);
  }

  if (section === "health") {
    const h = data.health;
    const waterPart = clamp(h.waterCups / h.waterTarget, 0, 1);
    const workoutPart = h.workoutDone ? 1 : 0;
    const sleepPart = clamp(h.sleepHours / h.sleepTarget, 0, 1);
    return Math.round(((waterPart + workoutPart + sleepPart) / 3) * 100);
  }

  const p = data.personal;
  const done = [p.familyCheck, p.roomReset, p.tomorrowPlan].filter(Boolean).length;
  return Math.round((done / 3) * 100);
}

export function getChallengeForDate(date: Date) {
  const seed = Math.floor(date.getTime() / 86_400_000);
  return DAILY_CHALLENGES[Math.abs(seed) % DAILY_CHALLENGES.length];
}

export function countCompletedUnits(data: LifeData) {
  let done = 0;
  let total = 0;

  const boolValues = [
    data.religious.fajr,
    data.religious.dhuhr,
    data.religious.asr,
    data.religious.maghrib,
    data.religious.isha,
    data.religious.adhkarMorning,
    data.religious.adhkarEvening,
    data.study.lecturesReviewed,
    data.career.portfolioStep,
    data.career.networkingStep,
    data.health.workoutDone,
    data.personal.familyCheck,
    data.personal.roomReset,
    data.personal.tomorrowPlan,
  ];

  total += boolValues.length;
  done += boolValues.filter(Boolean).length;

  const numericGoals = [
    data.religious.quranPages >= data.religious.quranTarget,
    data.study.focusSessions >= data.study.focusTarget,
    data.study.assignmentProgress >= 100,
    data.career.skillMinutes >= data.career.skillTarget,
    data.health.waterCups >= data.health.waterTarget,
    data.health.sleepHours >= data.health.sleepTarget,
  ];

  total += numericGoals.length;
  done += numericGoals.filter(Boolean).length;

  return { done, total };
}
