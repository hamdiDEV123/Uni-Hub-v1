import { useEffect, useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { HeroDashboard } from "@/components/workspace/HeroDashboard";
import { SectionDetails } from "@/components/workspace/SectionDetails";
import { SectionGrid } from "@/components/workspace/SectionGrid";
import { type SectionKey } from "@/lib/workspace/schema";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";

const ROUTE_TO_SECTION: Record<string, SectionKey> = {
  study: "study",
  studyworkspace: "study",
  religious: "religious",
  religiousworkspace: "religious",
  career: "career",
  careerworkspace: "career",
  health: "health",
  healthworkspace: "health",
  personal: "personal",
  personalworkspace: "personal",
};

const SECTION_TO_ROUTE: Record<SectionKey, string> = {
  study: "StudyWorkspace",
  religious: "ReligiousWorkspace",
  career: "CareerWorkspace",
  health: "HealthWorkspace",
  personal: "PersonalWorkspace",
};

function parseSectionFromRoute(sectionPath?: string): SectionKey | null {
  if (!sectionPath) return null;
  return ROUTE_TO_SECTION[sectionPath.toLowerCase()] ?? null;
}

export default function Workspace() {
  const navigate = useNavigate();
  const { sectionPath } = useParams<{ sectionPath?: string }>();

  const {
    now,
    lifeData,
    updateLifeData,
    overallProgress,
    strongestSection,
    weakestSection,
    completedUnits,
    dailyChallenge,
    statusText,
    setActiveSection,
    markChallengeStart,
    markChallengeCompletion,
  } = useWorkspaceData();

  const activeSection = useMemo(() => parseSectionFromRoute(sectionPath), [sectionPath]);

  useEffect(() => {
    if (activeSection) setActiveSection(activeSection);
  }, [activeSection, setActiveSection]);

  if (sectionPath && !activeSection) {
    return <Navigate to="/workspace" replace />;
  }

  const openSection = (section: SectionKey) => {
    navigate(`/workspace/${SECTION_TO_ROUTE[section]}`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {!activeSection ? (
        <>
          <HeroDashboard
            now={now}
            statusText={statusText}
            strongestLabel={strongestSection.label}
            strongestValue={strongestSection.value}
            weakestLabel={weakestSection.label}
            weakestValue={weakestSection.value}
            completedDone={completedUnits.done}
            completedTotal={completedUnits.total}
            overallProgress={overallProgress}
            dailyChallenge={dailyChallenge}
            onOpenWeakest={() => openSection(weakestSection.id)}
            onOpenChallenge={(section) => {
              markChallengeStart();
              openSection(section);
            }}
          />

          <SectionGrid lifeData={lifeData} onOpenSection={openSection} />
        </>
      ) : (
        <SectionDetails
          section={activeSection}
          lifeData={lifeData}
          setLifeData={updateLifeData}
          dailyChallenge={dailyChallenge}
          onChallengeComplete={markChallengeCompletion}
          onBack={() => navigate("/workspace")}
        />
      )}
    </div>
  );
}
