import type {
  AdminProductAction,
  MarketManualPaymentStatus,
  MarketOrderStatus,
  MarketPaymentMethod,
  SellerTier,
} from "@/backend/contracts";
export type { AdminProductAction } from "@/backend/contracts";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/backend/rpc";

export interface MarketCheckoutBreakdown {
  subtotal: number;
  service_fee: number;
  payment_method_fee: number;
  total: number;
}

export interface SubmitManualReceiptInput {
  orderId: string;
  paymentMethod: Extract<MarketPaymentMethod, "vodafone_cash" | "instapay">;
  senderPhone?: string;
  transferReference?: string;
  receiptImageUrl: string;
}

export interface CreateMarketProductListingInput {
  title: string;
  description?: string;
  category: "Medical" | "Engineering" | "Tech" | "Scrap";
  price: number;
  stockQty: number;
  productCondition?: string;
  phone?: string;
  imageUrls: string[];
  isNegotiable?: boolean;
}

export async function addMarketCartItemSecure(
  productId: string,
  quantity = 1
): Promise<number> {
  const { data, error } = await supabase.rpc("add_market_cart_item_secure", {
    _product_id: productId,
    _quantity: quantity,
  });

  if (error) throw error;
  return Number(data ?? 0);
}

// --- vendor helpers ------------------------------------------------------

export interface VendorProfile {
  id: string;
  type: "casual" | "student_pro" | "big_brand" | "external";
  shop_name: string;
  logo_url?: string | null;
  verified: boolean;
  campus_id?: string | null;
  subscription_status?: string | null;
}

export async function createVendor(
  userId: string,
  type: VendorProfile["type"],
  shopName: string,
  logoUrl?: string | null,
  campusId?: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc("create_vendor", {
    _user_id: userId,
    _type: type,
    _shop_name: shopName,
    _logo_url: logoUrl ?? null,
    _campus_id: campusId ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function getVendorByUser(userId: string): Promise<VendorProfile | null> {
  const { data, error } = await supabase.rpc("get_vendor_by_user", {
    _user_id: userId,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? (data as unknown as VendorProfile[]) : [];
  return rows[0] ?? null;
}

export async function calculateCommission(vendorId: string, total: number): Promise<number> {
  const { data, error } = await supabase.rpc("calculate_commission", {
    _vendor_id: vendorId,
    _order_total: total,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getVendorSettings(vendorId: string): Promise<{
  commission_rate: number;
  shipping_fee: number;
  currency: string;
} | null> {
  const { data, error } = await supabase.rpc("get_vendor_settings", {
    _vendor_id: vendorId,
  });
  if (error) throw error;
  type VendorSettingsRow = {
    commission_rate: number;
    shipping_fee: number;
    currency: string;
  };
  const rows = Array.isArray(data) ? (data as unknown as VendorSettingsRow[]) : [];
  return rows[0] ?? null;
}

// --- analytics & ads ------------------------------------------------------

export async function recordProductView(
  productId: string,
  userId?: string | null
): Promise<void> {
  const { error } = await supabase
    .from("product_views")
    .insert({ product_id: productId, user_id: userId ?? null });
  if (error) throw error;
}

export interface MarketplaceAd {
  id: string;
  vendor_id: string;
  product_id: string | null;
  start_at: string;
  end_at: string;
  budget: number;
  created_at: string;
}

export async function getActiveAds(): Promise<MarketplaceAd[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("marketplace_ads")
    .select("*")
    .gte("start_at", now)
    .lte("end_at", now);
  if (error) throw error;
  return (data ?? []) as MarketplaceAd[];
}

export async function createMarketplaceAd(
  vendorId: string,
  startAt: string,
  endAt: string,
  budget: number,
  productId?: string | null
): Promise<string> {
  const { data, error } = await supabase
    .from("marketplace_ads")
    .insert({
      vendor_id: vendorId,
      start_at: startAt,
      end_at: endAt,
      budget,
      product_id: productId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (!data || typeof (data as { id?: unknown }).id !== "string") {
    throw new Error("تعذر إنشاء الإعلان");
  }
  return (data as { id: string }).id;
}

export async function createMarketProductListingSecure(
  input: CreateMarketProductListingInput
): Promise<string> {
  const { data, error } = await supabase.rpc("create_market_product_listing_secure", {
    _title: input.title,
    _description: input.description ?? "",
    _category: input.category,
    _price: input.price,
    _stock_qty: input.stockQty,
    _product_condition: input.productCondition ?? "used",
    _phone: input.phone ?? null,
    _image_urls: input.imageUrls,
    _is_negotiable: input.isNegotiable ?? false,
  });

  if (error) throw error;
  return String(data);
}

export async function createMarketCheckoutOrder(
  productId: string,
  paymentMethod: MarketPaymentMethod = "cash_on_delivery"
): Promise<string> {
  return callRpc("create_market_checkout_order", {
    _product_id: productId,
    _payment_method: paymentMethod,
  });
}

export async function createMarketCheckoutFromCart(
  addressId: string,
  paymentMethod: MarketPaymentMethod = "cash_on_delivery"
): Promise<number> {
  return callRpc("create_market_checkout_from_cart", {
    _address_id: addressId,
    _payment_method: paymentMethod,
  });
}

export async function getMarketCheckoutBreakdown(
  subtotal: number,
  paymentMethod: MarketPaymentMethod = "cash_on_delivery"
): Promise<MarketCheckoutBreakdown> {
  const rows = await callRpc("get_market_checkout_breakdown", {
    _subtotal: subtotal,
    _payment_method: paymentMethod,
  });

  return (
    rows?.[0] ?? {
      subtotal,
      service_fee: 0,
      payment_method_fee: 0,
      total: subtotal,
    }
  );
}

export async function submitMarketManualPaymentReceipt(
  input: SubmitManualReceiptInput
): Promise<string> {
  return callRpc("submit_market_manual_payment_receipt", {
    _order_id: input.orderId,
    _payment_method: input.paymentMethod,
    _sender_phone: input.senderPhone ?? null,
    _transfer_reference: input.transferReference ?? null,
    _receipt_image_url: input.receiptImageUrl,
  });
}

export async function reviewMarketManualPaymentReceipt(
  orderId: string,
  approve: boolean,
  adminNote?: string
): Promise<MarketManualPaymentStatus> {
  return callRpc("review_market_manual_payment_receipt", {
    _order_id: orderId,
    _approve: approve,
    _admin_note: adminNote ?? null,
  });
}

export async function transitionMarketOrderStatus(
  orderId: string,
  newStatus: MarketOrderStatus,
  reason?: string
): Promise<MarketOrderStatus> {
  return callRpc("transition_market_order_status", {
    _order_id: orderId,
    _new_status: newStatus,
    _reason: reason ?? null,
  });
}

export async function requestMarketPayout(amount?: number): Promise<string> {
  return callRpc("request_market_payout", {
    _amount: amount ?? null,
  });
}

export async function requestMarketSellerTierUpgrade(
  requestedTier: SellerTier,
  note?: string
): Promise<string> {
  return callRpc("request_market_seller_tier_upgrade", {
    _requested_tier: requestedTier,
    _note: note ?? null,
  });
}

export async function reviewMarketSellerUpgradeRequest(
  requestId: string,
  approve: boolean,
  adminNote?: string
): Promise<"pending" | "approved" | "rejected"> {
  return callRpc("review_market_seller_upgrade_request", {
    _request_id: requestId,
    _approve: approve,
    _admin_note: adminNote ?? null,
  });
}

export async function reviewMarketPayoutRequest(
  payoutId: string,
  approve: boolean,
  adminNote?: string
): Promise<string> {
  const result = await callRpc("review_market_payout_request", {
    _payout_id: payoutId,
    _approve: approve,
    _admin_note: adminNote ?? null,
  });
  return String(result ?? "");
}

export async function adminManageMarketProduct(
  action: AdminProductAction,
  productId?: string,
  reason?: string
): Promise<string> {
  return callRpc("admin_manage_market_product", {
    _product_id: productId ?? null,
    _action: action,
    _reason: reason ?? null,
  });
}

export async function buildMarketOrderRoute(
  orderId: string,
  mode: "buyer" | "seller" = "buyer"
): Promise<string> {
  return callRpc("market_order_route", {
    _order_id: orderId,
    _mode: mode,
  });
}
