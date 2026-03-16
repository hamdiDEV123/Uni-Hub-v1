import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AdminFinanceRow = Database["public"]["Tables"]["admin_finances"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export type VerificationProfile = Pick<
  ProfileRow,
  | "id"
  | "full_name"
  | "email"
  | "university_id"
  | "role"
  | "verified_status"
  | "is_verified_runner"
  | "university_card_url"
  | "admin_notes"
  | "updated_at"
>;

export interface ReviewProfileVerificationInput {
  profileId: string;
  approve: boolean;
  adminNote?: string;
  clearDocumentOnReject?: boolean;
}

export async function fetchVerificationProfiles(limit = 120): Promise<VerificationProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,full_name,email,university_id,role,verified_status,is_verified_runner,university_card_url,admin_notes,updated_at"
    )
    .or("university_card_url.not.is.null,verified_status.eq.true")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as VerificationProfile[];
}

export async function reviewProfileVerification(input: ReviewProfileVerificationInput): Promise<void> {
  const updates: Database["public"]["Tables"]["profiles"]["Update"] = {
    verified_status: input.approve,
    is_verified_runner: input.approve,
    admin_notes: input.adminNote?.trim() || null,
  };

  if (!input.approve && input.clearDocumentOnReject !== false) {
    updates.university_card_url = null;
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", input.profileId);

  if (error) {
    throw error;
  }
}

export type AdminFinanceType = AdminFinanceRow["type"];

export interface AdminFinanceSummary {
  totalAmount: number;
  thisMonthAmount: number;
  entries: number;
  byType: Record<AdminFinanceType, number>;
}

export async function fetchAdminFinanceEntries(limit = 160): Promise<AdminFinanceRow[]> {
  const { data, error } = await supabase
    .from("admin_finances")
    .select("id,amount,type,seller_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminFinanceRow[];
}

export function buildAdminFinanceSummary(entries: AdminFinanceRow[]): AdminFinanceSummary {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const byType: Record<AdminFinanceType, number> = {
    commission: 0,
    featured_ad: 0,
    b2b_subscription: 0,
  };

  let totalAmount = 0;
  let thisMonthAmount = 0;

  for (const entry of entries) {
    const amount = Number(entry.amount ?? 0);
    totalAmount += amount;

    if (new Date(entry.created_at) >= monthStart) {
      thisMonthAmount += amount;
    }

    byType[entry.type] += amount;
  }

  return {
    totalAmount,
    thisMonthAmount,
    entries: entries.length,
    byType,
  };
}

export type FeaturedProduct = Pick<
  ProductRow,
  "id" | "title" | "price" | "seller_id" | "is_featured" | "listing_status" | "moderation_status" | "created_at"
> & {
  seller: { full_name: string | null } | null;
};

type RawFeaturedProduct = Omit<FeaturedProduct, "seller"> & {
  profiles: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

export async function fetchFeaturedProducts(limit = 120): Promise<FeaturedProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id,title,price,seller_id,is_featured,listing_status,moderation_status,created_at,profiles:seller_id(full_name)"
    )
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as RawFeaturedProduct[];

  return rows.map((row) => {
    const seller = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null;
    return {
      id: row.id,
      title: row.title,
      price: row.price,
      seller_id: row.seller_id,
      is_featured: row.is_featured,
      listing_status: row.listing_status,
      moderation_status: row.moderation_status,
      created_at: row.created_at,
      seller,
    };
  });
}

export async function setProductFeatured(productId: string, isFeatured: boolean): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ is_featured: isFeatured })
    .eq("id", productId);

  if (error) {
    throw error;
  }
}

export function isProfilePendingVerification(profile: VerificationProfile): boolean {
  return Boolean(profile.university_card_url) && !profile.verified_status;
}

export interface StudyHubTopMaterial {
  id: string;
  title: string;
  university: string;
  course_name: string;
  upvotes: number;
  downvotes: number;
  score: number;
  reports: number;
  views: number;
}

export interface StudyHubAdminSnapshot {
  totalMaterials: number;
  activeMaterials: number;
  pendingMaterials: number;
  removedMaterials: number;
  totalReports: number;
  totalViews: number;
  topRated: StudyHubTopMaterial[];
  mostReported: StudyHubTopMaterial[];
  mostViewed: StudyHubTopMaterial[];
}

export interface StudyHubReportedMaterial {
  id: string;
  title: string;
  university: string;
  course_name: string;
  status: string;
  reports: number;
  last_reported_at: string | null;
  sample_reasons: string[];
}

export async function fetchStudyHubAdminSnapshot(): Promise<StudyHubAdminSnapshot> {
  const { data: materials, error: materialsError } = await supabase
    .from("study_materials")
    .select("id,title,university,course_name,upvotes,downvotes,status");

  if (materialsError) throw materialsError;

  const { data: reports, error: reportsError } = await supabase
    .from("study_material_reports")
    .select("material_id");

  if (reportsError) throw reportsError;

  const { data: views, error: viewsError } = await supabase
    .from("study_material_views")
    .select("material_id");

  if (viewsError) throw viewsError;

  const reportCount = new Map<string, number>();
  for (const row of reports ?? []) {
    reportCount.set(row.material_id, (reportCount.get(row.material_id) ?? 0) + 1);
  }

  const viewCount = new Map<string, number>();
  for (const row of views ?? []) {
    viewCount.set(row.material_id, (viewCount.get(row.material_id) ?? 0) + 1);
  }

  const rows = (materials ?? []).map((row) => {
    const upvotes = Number(row.upvotes ?? 0);
    const downvotes = Number(row.downvotes ?? 0);
    const reportsCount = reportCount.get(row.id) ?? 0;
    const viewsCount = viewCount.get(row.id) ?? 0;

    return {
      id: row.id,
      title: row.title,
      university: row.university,
      course_name: row.course_name,
      upvotes,
      downvotes,
      score: upvotes - downvotes,
      reports: reportsCount,
      views: viewsCount,
      status: row.status,
    };
  });

  const totalMaterials = rows.length;
  const activeMaterials = rows.filter((row) => row.status === "active").length;
  const pendingMaterials = rows.filter((row) => row.status === "under_review").length;
  const removedMaterials = rows.filter((row) => row.status === "removed").length;
  const totalReports = reports?.length ?? 0;
  const totalViews = views?.length ?? 0;

  const byScore = [...rows].sort((left, right) => right.score - left.score).slice(0, 5);
  const byReports = [...rows].sort((left, right) => right.reports - left.reports).slice(0, 5);
  const byViews = [...rows].sort((left, right) => right.views - left.views).slice(0, 5);

  return {
    totalMaterials,
    activeMaterials,
    pendingMaterials,
    removedMaterials,
    totalReports,
    totalViews,
    topRated: byScore,
    mostReported: byReports,
    mostViewed: byViews,
  };
}

export async function fetchStudyHubReportedMaterials(limit = 60): Promise<StudyHubReportedMaterial[]> {
  const { data: materials, error: materialsError } = await supabase
    .from("study_materials")
    .select("id,title,university,course_name,status");

  if (materialsError) throw materialsError;

  const { data: reports, error: reportsError } = await supabase
    .from("study_material_reports")
    .select("material_id,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (reportsError) throw reportsError;

  const materialMap = new Map((materials ?? []).map((item) => [item.id, item]));
  const grouped = new Map<
    string,
    { reports: number; lastReportedAt: string | null; reasons: Set<string> }
  >();

  for (const report of reports ?? []) {
    if (!materialMap.has(report.material_id)) continue;

    const current = grouped.get(report.material_id) ?? {
      reports: 0,
      lastReportedAt: null,
      reasons: new Set<string>(),
    };

    current.reports += 1;
    if (!current.lastReportedAt || new Date(report.created_at) > new Date(current.lastReportedAt)) {
      current.lastReportedAt = report.created_at;
    }

    if (report.reason?.trim()) {
      current.reasons.add(report.reason.trim());
    }

    grouped.set(report.material_id, current);
  }

  return Array.from(grouped.entries())
    .map(([materialId, stats]) => {
      const material = materialMap.get(materialId);
      if (!material) return null;

      return {
        id: material.id,
        title: material.title,
        university: material.university,
        course_name: material.course_name,
        status: material.status,
        reports: stats.reports,
        last_reported_at: stats.lastReportedAt,
        sample_reasons: Array.from(stats.reasons).slice(0, 3),
      };
    })
    .filter((item): item is StudyHubReportedMaterial => item !== null)
    .sort((left, right) => {
      if (right.reports !== left.reports) return right.reports - left.reports;
      return new Date(right.last_reported_at ?? 0).getTime() - new Date(left.last_reported_at ?? 0).getTime();
    })
    .slice(0, limit);
}

export async function setStudyMaterialStatus(materialId: string, status: "active" | "under_review" | "removed"): Promise<void> {
  const { error } = await supabase
    .from("study_materials")
    .update({ status })
    .eq("id", materialId);

  if (error) throw error;
}

export async function clearStudyMaterialReports(materialId: string): Promise<void> {
  const { error } = await supabase
    .from("study_material_reports")
    .delete()
    .eq("material_id", materialId);

  if (error) throw error;
}
