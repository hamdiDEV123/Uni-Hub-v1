import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type StudyMaterialType =
  | "doctor_lecture"
  | "ta_section"
  | "student_summary"
  | "past_exam";

export type StudyMaterialStatus = "active" | "under_review" | "removed";

export type StudyMaterialRow = Database["public"]["Tables"]["study_materials"]["Row"];
type StudyMaterialInsert = Database["public"]["Tables"]["study_materials"]["Insert"];

export interface StudyMaterialWithMeta extends StudyMaterialRow {
  score: number;
  user_vote: -1 | 0 | 1;
  is_favorite: boolean;
  viewed_at: string | null;
}

export interface StudyMaterialFilters {
  university?: string;
  faculty?: string;
  studyYear?: string;
  term?: string;
  courseName?: string;
  materialType?: StudyMaterialType | "all";
}

export interface CreateStudyMaterialInput {
  ownerId: string;
  university: string;
  faculty: string;
  studyYear: string;
  term: string;
  courseName: string;
  materialType: StudyMaterialType;
  title: string;
  description?: string;
  resourceUrl: string;
  resourceUrlBackup?: string;
}

export interface ReportStudyMaterialInput {
  materialId: string;
  reporterId: string;
  reason?: string;
}

export interface UpdateStudyMaterialInput {
  materialId: string;
  title?: string;
  description?: string;
  resourceUrl?: string;
  resourceUrlBackup?: string;
}

const DAILY_STUDY_MATERIAL_UPLOAD_LIMIT = 3;

export async function uploadStudyMaterialPdf(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const folder = import.meta.env.VITE_CLOUDINARY_STUDY_HUB_FOLDER ?? "study-hub";
  const maxRawFileSizeBytes = 10 * 1024 * 1024;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary غير مُعد. أضف مفاتيح البيئة المطلوبة");
  }

  if (file.type !== "application/pdf") {
    throw new Error("الملف يجب أن يكون PDF فقط");
  }

  if (file.size > maxRawFileSizeBytes) {
    throw new Error("حجم ملف PDF يجب ألا يتجاوز 10MB");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);
  formData.append("resource_type", "raw");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "فشل رفع الملف");
  }

  const payload = (await response.json()) as { secure_url?: string };
  if (!payload.secure_url) {
    throw new Error("تعذر الحصول على رابط الملف بعد الرفع");
  }

  return payload.secure_url;
}

function normalizeStudyResourceUrl(resourceUrl: string): string {
  const raw = resourceUrl.trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return id ? `youtube:${id.toLowerCase()}` : raw.toLowerCase();
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v") ?? "";
        if (id) return `youtube:${id.toLowerCase()}`;
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      if ((parts[0] === "embed" || parts[0] === "shorts") && parts[1]) {
        return `youtube:${parts[1].toLowerCase()}`;
      }
    }

    const pathname = parsed.pathname.replace(/\/$/, "");
    const params = Array.from(parsed.searchParams.entries())
      .filter(([key]) => !key.toLowerCase().startsWith("utm_"))
      .sort(([left], [right]) => left.localeCompare(right));

    const normalizedQuery = params.length
      ? `?${params.map(([key, value]) => `${key}=${value}`).join("&")}`
      : "";

    return `${host}${pathname.toLowerCase()}${normalizedQuery}`;
  } catch {
    return raw.toLowerCase();
  }
}

function computeHybridRank(row: Pick<StudyMaterialRow, "upvotes" | "downvotes" | "created_at">): number {
  const upvotes = Number(row.upvotes ?? 0);
  const downvotes = Number(row.downvotes ?? 0);
  const baseScore = upvotes - downvotes;

  const totalVotes = Math.max(0, upvotes + downvotes);
  const engagementBoost = Math.log10(totalVotes + 1);

  const createdAt = new Date(row.created_at).getTime();
  const ageHours = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60));

  const recencyBoost = 3 * Math.exp(-ageHours / 72);

  return baseScore + engagementBoost + recencyBoost;
}

export async function fetchStudyMaterials(
  filters: StudyMaterialFilters,
  userId?: string
): Promise<StudyMaterialWithMeta[]> {
  let query = supabase.from("study_materials").select("*").eq("status", "active");

  if (filters.university && filters.university !== "all") {
    query = query.eq("university", filters.university.trim());
  }

  if (filters.faculty && filters.faculty !== "all") {
    query = query.eq("faculty", filters.faculty.trim());
  }

  if (filters.studyYear && filters.studyYear !== "all") {
    query = query.eq("study_year", filters.studyYear.trim());
  }

  if (filters.term && filters.term !== "all") {
    query = query.eq("term", filters.term.trim());
  }

  if (filters.materialType && filters.materialType !== "all") {
    query = query.eq("material_type", filters.materialType);
  }

  if (filters.courseName?.trim()) {
    query = query.ilike("course_name", `%${filters.courseName.trim()}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);

  if (error) throw error;

  const rows = (data ?? []) as StudyMaterialRow[];

  const votesByMaterialId = new Map<string, -1 | 0 | 1>();
  const favoriteIds = new Set<string>();
  const viewedAtByMaterialId = new Map<string, string>();

  if (userId && rows.length > 0) {
    const ids = rows.map((row) => row.id);
    const { data: votes, error: votesError } = await supabase
      .from("study_material_votes")
      .select("material_id,vote")
      .eq("user_id", userId)
      .in("material_id", ids);

    if (votesError) throw votesError;

    for (const voteRow of votes ?? []) {
      const voteValue = Number(voteRow.vote);
      votesByMaterialId.set(voteRow.material_id, voteValue === 1 ? 1 : voteValue === -1 ? -1 : 0);
    }

    const { data: favorites, error: favoritesError } = await supabase
      .from("study_material_favorites")
      .select("material_id")
      .eq("user_id", userId)
      .in("material_id", ids);

    if (favoritesError) throw favoritesError;

    for (const favoriteRow of favorites ?? []) {
      favoriteIds.add(favoriteRow.material_id);
    }

    const { data: views, error: viewsError } = await supabase
      .from("study_material_views")
      .select("material_id,viewed_at")
      .eq("user_id", userId)
      .in("material_id", ids);

    if (viewsError) throw viewsError;

    for (const viewRow of views ?? []) {
      viewedAtByMaterialId.set(viewRow.material_id, viewRow.viewed_at);
    }
  }

  return rows
    .map((row) => ({
      ...row,
      score: Number(row.upvotes ?? 0) - Number(row.downvotes ?? 0),
      user_vote: votesByMaterialId.get(row.id) ?? 0,
      is_favorite: favoriteIds.has(row.id),
      viewed_at: viewedAtByMaterialId.get(row.id) ?? null,
    }))
    .sort((left, right) => {
      const rightRank = computeHybridRank(right);
      const leftRank = computeHybridRank(left);
      if (rightRank !== leftRank) return rightRank - leftRank;
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
}

export async function addStudyMaterialFavorite(materialId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("study_material_favorites").insert({
    material_id: materialId,
    user_id: userId,
  });

  if (error) throw error;
}

export async function removeStudyMaterialFavorite(materialId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("study_material_favorites")
    .delete()
    .eq("material_id", materialId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function recordStudyMaterialView(materialId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("study_material_views")
    .upsert(
      {
        material_id: materialId,
        user_id: userId,
        viewed_at: new Date().toISOString(),
      },
      { onConflict: "material_id,user_id" }
    );

  if (error) throw error;
}

export async function createStudyMaterial(input: CreateStudyMaterialInput): Promise<string> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const { count, error: countError } = await supabase
    .from("study_materials")
    .select("id", { head: true, count: "exact" })
    .eq("owner_id", input.ownerId)
    .gte("created_at", dayStart.toISOString());

  if (countError) throw countError;

  if ((count ?? 0) >= DAILY_STUDY_MATERIAL_UPLOAD_LIMIT) {
    throw new Error("الحد اليومي لإضافة المحتوى هو 3 ملفات لكل طالب");
  }

  const payload: StudyMaterialInsert = {
    owner_id: input.ownerId,
    university: input.university.trim(),
    faculty: input.faculty.trim(),
    study_year: input.studyYear.trim(),
    term: input.term.trim(),
    course_name: input.courseName.trim(),
    material_type: input.materialType,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    resource_url: input.resourceUrl.trim(),
    resource_url_backup: input.resourceUrlBackup?.trim() || null,
    resource_url_normalized: normalizeStudyResourceUrl(input.resourceUrl),
  };

  const { data, error } = await supabase
    .from("study_materials")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("تعذر إنشاء المصدر الدراسي");

  return data.id;
}

export async function voteStudyMaterial(
  materialId: string,
  vote: -1 | 1
): Promise<{ upvotes: number; downvotes: number; score: number; user_vote: -1 | 0 | 1 }> {
  const { data, error } = await supabase.rpc("vote_study_material", {
    _material_id: materialId,
    _vote: vote,
  });

  if (error) throw error;

  const first = Array.isArray(data) ? data[0] : null;

  if (!first) {
    return {
      upvotes: 0,
      downvotes: 0,
      score: 0,
      user_vote: 0,
    };
  }

  const userVoteRaw = Number(first.user_vote ?? 0);

  return {
    upvotes: Number(first.upvotes ?? 0),
    downvotes: Number(first.downvotes ?? 0),
    score: Number(first.score ?? 0),
    user_vote: userVoteRaw === 1 ? 1 : userVoteRaw === -1 ? -1 : 0,
  };
}

export async function reportStudyMaterial(input: ReportStudyMaterialInput): Promise<void> {
  const { error } = await supabase.from("study_material_reports").insert({
    material_id: input.materialId,
    reporter_id: input.reporterId,
    reason: input.reason?.trim() || null,
  });

  if (error) throw error;
}

export async function updateStudyMaterial(input: UpdateStudyMaterialInput): Promise<void> {
  const updates: Database["public"]["Tables"]["study_materials"]["Update"] = {};

  if (typeof input.title === "string") {
    updates.title = input.title.trim();
  }

  if (typeof input.description === "string") {
    updates.description = input.description.trim() || null;
  }

  if (typeof input.resourceUrl === "string") {
    updates.resource_url = input.resourceUrl.trim();
    updates.resource_url_normalized = normalizeStudyResourceUrl(input.resourceUrl);
  }

  if (typeof input.resourceUrlBackup === "string") {
    updates.resource_url_backup = input.resourceUrlBackup.trim() || null;
  }

  const { error } = await supabase
    .from("study_materials")
    .update(updates)
    .eq("id", input.materialId);

  if (error) throw error;
}

export async function deleteStudyMaterial(materialId: string): Promise<void> {
  const { error } = await supabase
    .from("study_materials")
    .delete()
    .eq("id", materialId);

  if (error) throw error;
}
