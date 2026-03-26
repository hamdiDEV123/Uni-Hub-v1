import { CareerSection } from "@/components/workspace/sections/CareerSection";
import { HealthSection } from "@/components/workspace/sections/HealthSection";
import { PersonalSection } from "@/components/workspace/sections/PersonalSection";
import { ReligiousSection } from "@/components/workspace/sections/ReligiousSection";
import { StudySection } from "@/components/workspace/sections/StudySection";
import type { DailyChallenge, LifeData, SectionKey } from "@/lib/workspace/schema";

export function SectionDetails({
  section,
  lifeData,
  onBack,
  setLifeData,
  dailyChallenge,
  onChallengeComplete,
}: {
  section: SectionKey;
  lifeData: LifeData;
  onBack: () => void;
  setLifeData: (updater: (current: LifeData) => LifeData) => void;
  dailyChallenge: DailyChallenge;
  onChallengeComplete: (section: SectionKey) => void;
}) {
  const isChallengeSection = dailyChallenge.targetSection === section;

  if (section === "religious") {
    return (
      <ReligiousSection
        lifeData={lifeData}
        onBack={onBack}
        setLifeData={setLifeData}
        challenge={isChallengeSection ? dailyChallenge : undefined}
        onChallengeComplete={onChallengeComplete}
      />
    );
  }
  if (section === "study") {
    return (
      <StudySection
        lifeData={lifeData}
        onBack={onBack}
        setLifeData={setLifeData}
        challenge={isChallengeSection ? dailyChallenge : undefined}
        onChallengeComplete={onChallengeComplete}
      />
    );
  }
  if (section === "career") {
    return (
      <CareerSection
        lifeData={lifeData}
        onBack={onBack}
        setLifeData={setLifeData}
        challenge={isChallengeSection ? dailyChallenge : undefined}
        onChallengeComplete={onChallengeComplete}
      />
    );
  }
  if (section === "health") {
    return (
      <HealthSection
        lifeData={lifeData}
        onBack={onBack}
        setLifeData={setLifeData}
        challenge={isChallengeSection ? dailyChallenge : undefined}
        onChallengeComplete={onChallengeComplete}
      />
    );
  }
  return (
    <PersonalSection
      lifeData={lifeData}
      onBack={onBack}
      setLifeData={setLifeData}
      challenge={isChallengeSection ? dailyChallenge : undefined}
      onChallengeComplete={onChallengeComplete}
    />
  );
}
