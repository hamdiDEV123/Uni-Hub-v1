import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fetchProfileById, updateProfileById, updateProfileMediaUrlById } from "@/backend/profileApi";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

type ReviewRow = {
  id: string;
  rating: number | null;
  comment: string | null;
  created_at: string;
};

function buildProfileMediaPath(userId: string, file: File, kind: "avatar" | "cover"): string {
  const extensionMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "jpg";
  return `profile-media/${userId}/${kind}-${crypto.randomUUID()}.${extension}`;
}

export default function ProfileV2() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Database["public"]["Enums"]["gender_type"] | "">("");
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [studyYear, setStudyYear] = useState("");

  const profileQuery = useQuery<ProfileRow>({
    queryKey: ["profile-v2", user?.id ?? ""],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error("Missing user id");
      }
      return fetchProfileById(user.id);
    },
  });

  const { data: history = [] } = useQuery<OrderRow[]>({
    queryKey: ["profile-history-v2", user?.id ?? ""],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .or(`buyer_id.eq.${user?.id},runner_id.eq.${user?.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reviews = [] } = useQuery<ReviewRow[]>({
    queryKey: ["profile-reviews-v2", user?.id ?? ""],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at")
        .eq("target_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReviewRow[];
    },
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setBio(profile.bio ?? "");
    setPhone(profile.phone ?? "");
    setGender(profile.gender ?? "");
    setUniversity(profile.university ?? "");
    setFaculty(profile.faculty ?? "");
    setStudyYear(profile.study_year ?? "");
  }, [profileQuery.data]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");

      const trimmedFullName = fullName.trim();
      if (trimmedFullName.length < 3) throw new Error("الاسم يجب أن يكون 3 أحرف على الأقل");
      if (!university.trim() || !faculty.trim() || !studyYear.trim()) {
        throw new Error("الجامعة والكلية والفرقة مطلوبة");
      }

      const payload: Database["public"]["Tables"]["profiles"]["Update"] = {
        full_name: trimmedFullName,
        bio: bio.trim() || null,
        phone: phone.trim() || null,
        gender: gender || null,
        university: university.trim(),
        faculty: faculty.trim(),
        study_year: studyYear.trim(),
        onboarding_completed: true,
      };

      await updateProfileById(user.id, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile-v2", user?.id ?? ""] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-profile", user?.id ?? ""] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary", user?.id ?? ""] }),
      ]);
      toast.success("تم حفظ بيانات البروفايل");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ البيانات");
    },
  });

  const uploadMediaMutation = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: "avatar" | "cover" }) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");

      const objectPath = buildProfileMediaPath(user.id, file, kind);
      const { error: uploadError } = await supabase.storage.from("product_images").upload(objectPath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product_images").getPublicUrl(objectPath);
      const publicUrl = data.publicUrl;

      await updateProfileMediaUrlById(user.id, kind, publicUrl);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile-v2", user?.id ?? ""] });
      toast.success("تم رفع الصورة بنجاح");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "تعذر رفع الصورة");
    },
  });

  const totalEarnings = useMemo(
    () => history.filter((item) => item.runner_id === user?.id && item.status === "delivered").reduce((sum, item) => sum + Number(item.fee ?? 0), 0),
    [history, user?.id]
  );

  const completedMissions = useMemo(
    () => history.filter((item) => item.runner_id === user?.id && item.status === "delivered").length,
    [history, user?.id]
  );

  const averageRating = useMemo(() => {
    if (!reviews.length) return "0.0";
    const average = reviews.reduce((sum, item) => sum + Number(item.rating ?? 0), 0) / reviews.length;
    return average.toFixed(1);
  }, [reviews]);

  if (profileQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground" dir="rtl">
        جاري تحميل الملف الشخصي...
      </div>
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="space-y-6" dir="rtl">
      <Card className="overflow-hidden border-navy/20 bg-card shadow-hard">
        <div className="relative h-44 w-full bg-muted/50">
          {profile?.cover_url ? <img src={profile.cover_url} alt="cover" className="h-full w-full object-cover" /> : null}
          <label className="absolute left-4 top-4 cursor-pointer rounded-xl border border-white/30 bg-black/40 px-3 py-2 text-xs font-bold text-white">
            غلاف
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadMediaMutation.mutate({ file, kind: "cover" });
              }}
            />
          </label>
        </div>

        <div className="relative p-6">
          <div className="absolute -top-12 right-6 h-24 w-24 overflow-hidden rounded-full border-4 border-card bg-card shadow-hard-sm">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" /> : null}
          </div>

          <div className="mr-32 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-foreground">{profile?.full_name || "طالب"}</h1>
              <p className="text-xs text-muted-foreground">{profile?.bio || "أضف نبذة قصيرة عنك"}</p>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
              <Camera className="h-4 w-4" />
              صورة البروفايل
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadMediaMutation.mutate({ file, kind: "avatar" });
                }}
              />
            </label>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-navy/20 bg-card p-4 shadow-hard-sm">
          <p className="text-xs text-muted-foreground">إجمالي الأرباح</p>
          <p className="mt-1 text-2xl font-black text-foreground">{totalEarnings.toFixed(2)} ج.م</p>
        </Card>
        <Card className="rounded-2xl border-navy/20 bg-card p-4 shadow-hard-sm">
          <p className="text-xs text-muted-foreground">المهام المكتملة</p>
          <p className="mt-1 text-2xl font-black text-foreground">{completedMissions}</p>
        </Card>
        <Card className="rounded-2xl border-navy/20 bg-card p-4 shadow-hard-sm">
          <p className="text-xs text-muted-foreground">متوسط التقييم</p>
          <p className="mt-1 text-2xl font-black text-foreground">{averageRating}</p>
        </Card>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="h-12 w-full rounded-xl border border-border bg-muted/40 p-1">
          <TabsTrigger value="basic" className="flex-1 rounded-lg">البيانات الأساسية</TabsTrigger>
          <TabsTrigger value="verification" className="flex-1 rounded-lg">التوثيق</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card className="space-y-4 rounded-2xl border-navy/20 bg-card p-5 shadow-hard-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">الاسم</p>
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">الهاتف</p>
                <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01xxxxxxxxx" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">الجامعة</p>
                <Input value={university} onChange={(event) => setUniversity(event.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">الكلية</p>
                <Input value={faculty} onChange={(event) => setFaculty(event.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">الفرقة</p>
                <Input value={studyYear} onChange={(event) => setStudyYear(event.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">النوع</p>
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value as Database["public"]["Enums"]["gender_type"] | "")}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">غير محدد</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                  <option value="any">لا يفرق</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">نبذة مختصرة</p>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={4}
                maxLength={240}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="اكتب نبذة قصيرة عنك"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending} className="gap-2">
                {saveProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التعديلات
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="verification">
          <Card className="rounded-2xl border-navy/20 bg-card p-5 shadow-hard-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-foreground">توثيق الحساب</p>
                <p className="text-xs text-muted-foreground">اختياري الآن — يصبح مهمًا للثقة في البيع والتوصيل</p>
              </div>
              {profile?.verified_status ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  موثق
                </span>
              ) : (
                <span className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">
                  غير موثق
                </span>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
