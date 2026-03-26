import {
  WORKSPACE_SCHEMA_VERSION,
  createDefaultAnalytics,
  createDefaultLifeData,
  createDefaultWorkspaceStorage,
  type LifeData,
  type WorkspaceStorage,
} from "@/lib/workspace/schema";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeLifeData(data: unknown): LifeData {
  const fallback = createDefaultLifeData();
  if (!isRecord(data)) return fallback;
  return {
    religious: { ...fallback.religious, ...(isRecord(data.religious) ? data.religious : {}) },
    study: { ...fallback.study, ...(isRecord(data.study) ? data.study : {}) },
    career: { ...fallback.career, ...(isRecord(data.career) ? data.career : {}) },
    health: { ...fallback.health, ...(isRecord(data.health) ? data.health : {}) },
    personal: { ...fallback.personal, ...(isRecord(data.personal) ? data.personal : {}) },
  };
}

function normalizeStorage(raw: unknown, today: string): WorkspaceStorage {
  if (!isRecord(raw)) return createDefaultWorkspaceStorage(today);
  const fallback = createDefaultWorkspaceStorage(today);
  const lastUpdatedDay = typeof raw.lastUpdatedDay === "string" ? raw.lastUpdatedDay : fallback.lastUpdatedDay;
  const lifeData = normalizeLifeData(raw.lifeData);

  const analytics = isRecord(raw.analytics)
    ? {
        challengeStarts:
          typeof raw.analytics.challengeStarts === "number" ? raw.analytics.challengeStarts : 0,
        challengeCompletions:
          typeof raw.analytics.challengeCompletions === "number" ? raw.analytics.challengeCompletions : 0,
        sectionOpens: {
          ...fallback.analytics.sectionOpens,
          ...(isRecord(raw.analytics.sectionOpens) ? raw.analytics.sectionOpens : {}),
        },
        challengeCompletionsBySection: {
          ...fallback.analytics.challengeCompletionsBySection,
          ...(isRecord(raw.analytics.challengeCompletionsBySection)
            ? raw.analytics.challengeCompletionsBySection
            : {}),
        },
      }
    : createDefaultAnalytics();

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    lastUpdatedDay,
    lifeData,
    analytics,
  };
}

export function migrateWorkspaceStorage(raw: unknown, today: string): WorkspaceStorage {
  if (!isRecord(raw)) return createDefaultWorkspaceStorage(today);

  if ("schemaVersion" in raw) {
    return normalizeStorage(raw, today);
  }

  // Legacy payload fallback (old plain LifeData object)
  return {
    ...createDefaultWorkspaceStorage(today),
    lifeData: normalizeLifeData(raw),
  };
}
