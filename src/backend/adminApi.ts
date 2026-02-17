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
