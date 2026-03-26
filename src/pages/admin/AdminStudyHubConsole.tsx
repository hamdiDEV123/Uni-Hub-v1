import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BookOpen, BarChart3, AlertTriangle, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  clearStudyMaterialReports,
  fetchStudyHubAdminSnapshot,
  fetchStudyHubReportedMaterials,
  setStudyMaterialStatus,
} from "@/backend/adminApi";

function AnalyticsCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="border-navy/20 bg-card shadow-hard-sm">
      <CardHeader className="pb-2 text-right">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span className="text-3xl font-black text-primary">{value}</span>
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <AlertTriangle size={36} className="mb-2 opacity-60" />
      <p>{msg}</p>
    </div>
  );
}

type ReportStatusFilter = "all" | "active" | "under_review" | "removed";

function getStatusLabel(status: string): string {
  if (status === "active") return "مفعّل";
  if (status === "under_review") return "قيد المراجعة";
  if (status === "removed") return "محذوف";
  return status;
}

export default function AdminStudyHubConsole() {
  const queryClient = useQueryClient();
  const [reportStatusFilter, setReportStatusFilter] = useState<ReportStatusFilter>("all");
  const [reportSearch, setReportSearch] = useState("");

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ["studyhub-admin-snapshot"],
    queryFn: fetchStudyHubAdminSnapshot,
  });

  const { data: reportedItems = [], isLoading: isReportedLoading } = useQuery({
    queryKey: ["studyhub-reported-materials"],
    queryFn: () => fetchStudyHubReportedMaterials(20),
  });

  const statusMutation = useMutation({
    mutationFn: ({ materialId, status }: { materialId: string; status: "active" | "under_review" | "removed" }) =>
      setStudyMaterialStatus(materialId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["studyhub-admin-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["studyhub-reported-materials"] });

      const statusText =
        variables.status === "active" ? "مفعل" : variables.status === "under_review" ? "قيد المراجعة" : "محذوف";
      toast.success(`تم تحديث الحالة إلى ${statusText}`);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث الحالة");
    },
  });

  const clearReportsMutation = useMutation({
    mutationFn: (materialId: string) => clearStudyMaterialReports(materialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyhub-admin-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["studyhub-reported-materials"] });
      toast.success("تم مسح البلاغات");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "تعذر مسح البلاغات");
    },
  });

  const filteredReportedItems = useMemo(() => {
    const searchTerm = reportSearch.trim().toLowerCase();

    return reportedItems.filter((item) => {
      const statusOk = reportStatusFilter === "all" || item.status === reportStatusFilter;
      if (!statusOk) return false;

      if (!searchTerm) return true;

      const haystack = `${item.title} ${item.course_name} ${item.university}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [reportedItems, reportStatusFilter, reportSearch]);

  return (
    <motion.div
      dir="rtl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="rounded-3xl border border-navy/20 bg-card p-5 shadow-hard">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          <BookOpen className="h-4 w-4" />
          إدارة Study Hub
        </div>
        <h1 className="text-3xl font-black text-primary">لوحة تحليلات بنك المحاضرات</h1>
        <p className="mt-2 text-sm text-muted-foreground">متابعة النشاط والجودة والبلاغات في قسم Study Hub.</p>
      </div>

      {isLoading ? (
        <Card className="border-navy/20 bg-card p-8 text-center text-muted-foreground">جاري تحميل البيانات...</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AnalyticsCard label="إجمالي المواد" value={snapshot?.totalMaterials ?? 0} icon={<BarChart3 size={18} />} />
            <AnalyticsCard label="مواد فعّالة" value={snapshot?.activeMaterials ?? 0} icon={<BookOpen size={18} />} />
            <AnalyticsCard label="مواد قيد المراجعة" value={snapshot?.pendingMaterials ?? 0} icon={<AlertTriangle size={18} />} />
            <AnalyticsCard label="إجمالي المشاهدات" value={snapshot?.totalViews ?? 0} icon={<Eye size={18} />} />
          </div>

          <Card className="border-navy/20 bg-card shadow-hard">
            <CardHeader>
              <CardTitle className="text-right">مركز إدارة البلاغات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Select value={reportStatusFilter} onValueChange={(value) => setReportStatusFilter(value as ReportStatusFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="فلتر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="active">مفعّل</SelectItem>
                    <SelectItem value="under_review">قيد المراجعة</SelectItem>
                    <SelectItem value="removed">محذوف</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  value={reportSearch}
                  onChange={(event) => setReportSearch(event.target.value)}
                  placeholder="بحث بالعنوان أو المادة أو الجامعة"
                  className="md:col-span-2"
                />
              </div>

              {isReportedLoading ? (
                <p className="text-right text-sm text-muted-foreground">جاري تحميل المواد المُبلغ عنها...</p>
              ) : filteredReportedItems.length === 0 ? (
                <EmptyState msg="لا توجد مواد مُبلغ عنها حاليًا" />
              ) : (
                filteredReportedItems.map((item) => (
                  <div key={item.id} className="space-y-3 rounded-2xl border border-navy/20 p-4 text-right">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.university} • {item.course_name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="destructive">بلاغات: {item.reports}</Badge>
                        <Badge variant="outline">الحالة: {getStatusLabel(item.status)}</Badge>
                      </div>
                    </div>

                    {item.sample_reasons.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.sample_reasons.map((reason, index) => (
                          <Badge key={`${item.id}-${index}`} variant="secondary">{reason}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ materialId: item.id, status: "under_review" })}
                        disabled={statusMutation.isPending}
                      >
                        قيد المراجعة
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => statusMutation.mutate({ materialId: item.id, status: "active" })}
                        disabled={statusMutation.isPending}
                      >
                        تفعيل
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => statusMutation.mutate({ materialId: item.id, status: "removed" })}
                        disabled={statusMutation.isPending}
                      >
                        إزالة
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => clearReportsMutation.mutate(item.id)}
                        disabled={clearReportsMutation.isPending}
                      >
                        مسح البلاغات
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="border-navy/20 bg-card shadow-hard">
              <CardHeader><CardTitle className="text-right">الأعلى تقييمًا</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(snapshot?.topRated ?? []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-navy/20 p-3 text-right">
                    <p className="line-clamp-1 font-bold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.university} • {item.course_name}</p>
                    <Badge className="mt-2">Score: {item.score}</Badge>
                  </div>
                ))}
                {(snapshot?.topRated?.length ?? 0) === 0 && <EmptyState msg="لا توجد بيانات" />}
              </CardContent>
            </Card>

            <Card className="border-navy/20 bg-card shadow-hard">
              <CardHeader><CardTitle className="text-right">الأكثر بلاغًا</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(snapshot?.mostReported ?? []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-navy/20 p-3 text-right">
                    <p className="line-clamp-1 font-bold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.university} • {item.course_name}</p>
                    <Badge variant="destructive" className="mt-2">بلاغات: {item.reports}</Badge>
                  </div>
                ))}
                {(snapshot?.mostReported?.length ?? 0) === 0 && <EmptyState msg="لا توجد بيانات" />}
              </CardContent>
            </Card>

            <Card className="border-navy/20 bg-card shadow-hard">
              <CardHeader><CardTitle className="text-right">الأكثر مشاهدة</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(snapshot?.mostViewed ?? []).map((item) => (
                  <div key={item.id} className="rounded-xl border border-navy/20 p-3 text-right">
                    <p className="line-clamp-1 font-bold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.university} • {item.course_name}</p>
                    <Badge variant="secondary" className="mt-2">مشاهدات: {item.views}</Badge>
                  </div>
                ))}
                {(snapshot?.mostViewed?.length ?? 0) === 0 && <EmptyState msg="لا توجد بيانات" />}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </motion.div>
  );
}
