import type {
  AdminProductAction,
  MarketManualPaymentStatus,
  MarketOrderStatus,
  MarketPaymentMethod,
  SellerTier,
} from "@/backend/contracts";
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
