export type AppRole = "buyer" | "seller" | "admin";

export type MarketPaymentMethod =
  | "cash_on_delivery"
  | "vodafone_cash"
  | "instapay";

export const MANUAL_PAYMENT_METHODS = ["vodafone_cash", "instapay"] as const;

export type MarketPaymentStatus = "pending" | "captured" | "failed" | "refunded";

export type MarketOrderStatus =
  | "pending_payment"
  | "paid_held"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type MarketManualPaymentStatus = "pending" | "approved" | "rejected";

export type MarketDisputeStatus = "open" | "resolved" | "rejected";

export type SellerTier =
  | "casual"
  | "student_pro"
  | "big_store"
  | "brand"
  | "pro";

export type ProductModerationStatus = "pending" | "approved" | "rejected";

export type ProductListingStatus =
  | "pending_review"
  | "active"
  | "paused"
  | "sold"
  | "archived";

export type AdminProductAction =
  | "approve"
  | "reject"
  | "archive"
  | "restore_activate"
  | "delete_now"
  | "bulk_cleanup";

export const MARKET_ORDER_TRANSITIONS: Record<
  AppRole,
  Partial<Record<MarketOrderStatus, MarketOrderStatus[]>>
> = {
  buyer: {
    shipped: ["delivered"],
    pending_payment: ["cancelled"],
    paid_held: ["cancelled"],
  },
  seller: {
    paid_held: ["processing"],
    processing: ["shipped"],
  },
  admin: {
    pending_payment: [
      "paid_held",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ],
    paid_held: ["processing", "shipped", "delivered", "cancelled", "refunded"],
    processing: ["shipped", "delivered", "cancelled", "refunded"],
    shipped: ["delivered", "cancelled", "refunded"],
    delivered: ["refunded"],
    cancelled: [],
    refunded: [],
  },
};

export function canTransitionMarketOrderStatus(
  role: AppRole,
  from: MarketOrderStatus,
  to: MarketOrderStatus
): boolean {
  if (role === "admin") {
    return from !== to;
  }

  const allowedTargets = MARKET_ORDER_TRANSITIONS[role][from] ?? [];
  return allowedTargets.includes(to);
}

export function isManualPaymentMethod(
  method: MarketPaymentMethod | string
): method is (typeof MANUAL_PAYMENT_METHODS)[number] {
  return (MANUAL_PAYMENT_METHODS as readonly string[]).includes(method);
}

