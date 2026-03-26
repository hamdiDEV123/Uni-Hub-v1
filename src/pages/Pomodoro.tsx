import { useNavigate, useSearchParams } from "react-router-dom";
import { StudyWorkspace } from "@/components/workspace/study/StudyWorkspace";
import { useWorkspaceData } from "@/hooks/useWorkspaceData";

export default function PomodoroPage() {
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section") ?? "study";

  const { setActiveSection } = useWorkspaceData();
  const navigate = useNavigate();

  const handleSessionStarted = () => {
    if (section === "study") setActiveSection("study");
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">بومودورو</h1>
        <p className="text-xs text-muted-foreground">قسم: {section}</p>
      </div>
      <StudyWorkspace
        initialView="pomodoro"
        onSessionStarted={handleSessionStarted}
        onSessionCompleted={() => {
          // هذه النقطة متاحة للتوثيق أو تنبيهات برعاية إنجاز الجلسة.
        }}
      />
      <button
        type="button"
        className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100"
        onClick={() => navigate(`/workspace/${section}`)}
      >
        العودة إلى {section === "study" ? "حياتي الدراسية" : section}
      </button>
    </div>
  );
}
