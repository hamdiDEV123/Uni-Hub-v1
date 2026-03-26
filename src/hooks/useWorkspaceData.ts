import { useEffect, useMemo, useState } from "react";
import { migrateWorkspaceStorage } from "@/lib/workspace/migrations";
import {
  LEGACY_LIFE_DATA_KEY,
  LEGACY_LIFE_DAY_KEY,
  SECTION_META,
  WORKSPACE_STORAGE_KEY,
  countCompletedUnits,
  createDefaultWorkspaceStorage,
  getChallengeForDate,
  sectionProgress,
  type SectionKey,
  type WorkspaceStorage,
} from "@/lib/workspace/schema";

function readRawStorage(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function loadInitialStorage(today: string): WorkspaceStorage {
  const current = readRawStorage(WORKSPACE_STORAGE_KEY);
  if (current) return migrateWorkspaceStorage(current, today);

  // Legacy migration path
  const legacyLifeData = readRawStorage(LEGACY_LIFE_DATA_KEY);
  if (!legacyLifeData) return createDefaultWorkspaceStorage(today);

  const migrated = migrateWorkspaceStorage(legacyLifeData, today);
  const legacyDay = readRawStorage(LEGACY_LIFE_DAY_KEY);
  if (typeof legacyDay === "string") {
    migrated.lastUpdatedDay = legacyDay;
  }
  return migrated;
}

export function useWorkspaceData() {
  const today = new Date().toDateString();
  const [now, setNow] = useState(() => new Date());
  const [activeSection, setActiveSectionState] = useState<SectionKey | null>(null);
  const [storage, setStorage] = useState<WorkspaceStorage>(() => loadInitialStorage(today));

  const lifeData = storage.lifeData;

  const sectionScores = useMemo(
    () => SECTION_META.map((section) => ({ ...section, value: sectionProgress(section.id, lifeData) })),
    [lifeData]
  );

  const overallProgress = useMemo(() => {
    return Math.round(sectionScores.reduce((sum, item) => sum + item.value, 0) / sectionScores.length);
  }, [sectionScores]);

  const strongestSection = useMemo(
    () => sectionScores.reduce((best, current) => (current.value > best.value ? current : best), sectionScores[0]),
    [sectionScores]
  );

  const weakestSection = useMemo(
    () => sectionScores.reduce((worst, current) => (current.value < worst.value ? current : worst), sectionScores[0]),
    [sectionScores]
  );

  const completedUnits = useMemo(() => countCompletedUnits(lifeData), [lifeData]);
  const dailyChallenge = useMemo(() => getChallengeForDate(now), [now]);

  const statusText =
    overallProgress >= 75
      ? "أنت على المسار الصحيح"
      : overallProgress >= 45
        ? "اليوم قابل للتحسين بخطوة واحدة مركزة"
        : "ابدأ الآن من القسم الأضعف لتكسر التسويف";

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (storage.lastUpdatedDay === today) return;
    setStorage((prev) => ({
      ...prev,
      lastUpdatedDay: today,
      lifeData: createDefaultWorkspaceStorage(today).lifeData,
    }));
  }, [storage.lastUpdatedDay, today]);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(storage));
  }, [storage]);

  const setActiveSection = (section: SectionKey | null) => {
    setActiveSectionState(section);
    if (!section) return;
    setStorage((prev) => ({
      ...prev,
      analytics: {
        ...prev.analytics,
        sectionOpens: {
          ...prev.analytics.sectionOpens,
          [section]: prev.analytics.sectionOpens[section] + 1,
        },
      },
    }));
  };

  const markChallengeStart = () => {
    setStorage((prev) => ({
      ...prev,
      analytics: {
        ...prev.analytics,
        challengeStarts: prev.analytics.challengeStarts + 1,
      },
    }));
  };

  const markChallengeCompletion = (section: SectionKey) => {
    setStorage((prev) => ({
      ...prev,
      analytics: {
        ...prev.analytics,
        challengeCompletions: prev.analytics.challengeCompletions + 1,
        challengeCompletionsBySection: {
          ...prev.analytics.challengeCompletionsBySection,
          [section]: prev.analytics.challengeCompletionsBySection[section] + 1,
        },
      },
    }));
  };

  const updateLifeData = (updater: (current: WorkspaceStorage["lifeData"]) => WorkspaceStorage["lifeData"]) => {
    setStorage((prev) => ({ ...prev, lifeData: updater(prev.lifeData) }));
  };

  return {
    now,
    activeSection,
    setActiveSection,
    lifeData,
    updateLifeData,
    sectionScores,
    overallProgress,
    strongestSection,
    weakestSection,
    completedUnits,
    dailyChallenge,
    statusText,
    markChallengeStart,
    markChallengeCompletion,
  };
}
