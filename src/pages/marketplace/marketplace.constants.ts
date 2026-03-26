import type { ListingMode } from "./marketplace.types";

export const CATEGORY_LABELS: Record<string, string> = {
  all: "كل التصنيفات",
  Medical: "طبي",
  Engineering: "هندسي",
  Tech: "تقني",
  Scrap: "خردة",
};

export const LISTING_STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  pending_review: "قيد المراجعة",
  sold: "تم البيع",
  archived: "مؤرشف",
};

export const MODERATION_STATUS_LABELS: Record<string, string> = {
  approved: "مقبول",
  pending: "معلّق",
  rejected: "مرفوض",
};

export const LISTING_MODE_LABELS: Record<ListingMode, string> = {
  sale: "بيع مباشر",
  rental: "إيجار",
  barter: "تبادل",
  service: "خدمة طلابية",
};
