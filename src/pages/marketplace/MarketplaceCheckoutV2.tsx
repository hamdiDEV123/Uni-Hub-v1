import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, MapPin, ShoppingCart, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createMarketCheckoutFromCart,
  createMarketCheckoutOrder,
  getMarketCheckoutBreakdown,
  submitMarketManualPaymentReceipt,
  type MarketCheckoutBreakdown,
} from "@/backend/marketplaceApi";
import type { MarketPaymentMethod } from "@/backend/contracts";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_OPTIONS: Array<{ code: MarketPaymentMethod; label: string; note: string }> = [
  {
    code: "cash_on_delivery",
    label: "Cash on delivery",
    note: "No transfer proof required",
  },
  {
    code: "vodafone_cash",
    label: "Vodafone Cash",
    note: "Buyer sends transfer then uploads receipt",
  },
  {
    code: "instapay",
    label: "Instapay",
    note: "Buyer sends transfer then uploads receipt",
  },
];

type CartItemView = {
  id: string;
  product_id: string;
  quantity: number;
  title: string;
  unitPrice: number;
  image?: string;
};

type AddressView = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  governorate: string;
  city: string;
  address_line: string;
  is_default: boolean;
};

export default function MarketplaceCheckoutV2() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const productId = searchParams.get("product") ?? "";
  const querySubtotal = Number(searchParams.get("subtotal") ?? 0);
  const isCartMode = searchParams.get("mode") === "cart" || !productId;

  const [paymentMethod, setPaymentMethod] = useState<MarketPaymentMethod>("cash_on_delivery");
  const [orderId, setOrderId] = useState<string>("");
  const [createdCartOrders, setCreatedCartOrders] = useState<number>(0);
  const [senderPhone, setSenderPhone] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [receiptImageUrl, setReceiptImageUrl] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const isManualMethod = paymentMethod === "vodafone_cash" || paymentMethod === "instapay";

  const { data: cartItems = [], isLoading: cartLoading } = useQuery({
    queryKey: ["marketplace-v2-cart-items-checkout", user?.id],
    enabled: Boolean(user?.id) && isCartMode,
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from("market_cart_items")
        .select("id,product_id,quantity")
        .eq("user_id", user!.id);
      if (error) throw error;
      if (!items?.length) return [] as CartItemView[];

      const productIds = [...new Set(items.map((item) => item.product_id))];
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id,title,price,image_url")
        .in("id", productIds);
      if (productsError) throw productsError;

      const productMap = new Map(
        (products ?? []).map((product) => [
          product.id,
          {
            title: product.title,
            price: Number(product.price ?? 0),
            image: product.image_url?.[0] ?? undefined,
          },
        ])
      );

      return items.map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity ?? 1,
        title: productMap.get(item.product_id)?.title ?? "Unknown product",
        unitPrice: productMap.get(item.product_id)?.price ?? 0,
        image: productMap.get(item.product_id)?.image,
      }));
    },
  });

  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ["marketplace-v2-addresses-checkout", user?.id],
    enabled: Boolean(user?.id) && isCartMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_addresses")
        .select("id,label,recipient_name,phone,governorate,city,address_line,is_default")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AddressView[];
    },
  });

  useEffect(() => {
    if (!isCartMode) return;
    if (selectedAddressId) return;
    const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0];
    if (defaultAddress) setSelectedAddressId(defaultAddress.id);
  }, [addresses, isCartMode, selectedAddressId]);

  const effectiveSubtotal = useMemo(() => {
    if (!isCartMode) return querySubtotal;
    return cartItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  }, [cartItems, isCartMode, querySubtotal]);

  const { data: breakdown } = useQuery({
    queryKey: ["marketplace-v2-breakdown", effectiveSubtotal, paymentMethod],
    enabled: effectiveSubtotal > 0,
    queryFn: async () => getMarketCheckoutBreakdown(effectiveSubtotal, paymentMethod),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (isCartMode) {
        if (!selectedAddressId) throw new Error("Select a delivery address first");
        return createMarketCheckoutFromCart(selectedAddressId, paymentMethod);
      }
      if (!productId) throw new Error("Missing product id");
      return createMarketCheckoutOrder(productId, paymentMethod);
    },
    onSuccess: (result) => {
      if (isCartMode) {
        const createdCount = Number(result ?? 0);
        setCreatedCartOrders(createdCount);
        setOrderId("");
        toast({
          title: "Cart checkout completed",
          description: `${createdCount} order(s) were created from cart.`,
        });
        return;
      }

      const createdOrderId = String(result);
      setOrderId(createdOrderId);
      setCreatedCartOrders(0);
      toast({
        title: "Order created",
        description: `Order #${createdOrderId.slice(0, 8)} was created successfully.`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Checkout failed",
        description: error instanceof Error ? error.message : "Could not create order",
        variant: "destructive",
      });
    },
  });

  const submitReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("Create order first");
      if (!receiptImageUrl) throw new Error("Receipt image URL is required");

      return submitMarketManualPaymentReceipt({
        orderId,
        paymentMethod: paymentMethod as "vodafone_cash" | "instapay",
        senderPhone,
        transferReference,
        receiptImageUrl,
      });
    },
    onSuccess: () => {
      toast({
        title: "Receipt submitted",
        description: "Admin review is pending.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Receipt submit failed",
        description: error instanceof Error ? error.message : "Could not submit receipt",
        variant: "destructive",
      });
    },
  });

  const effectiveBreakdown: MarketCheckoutBreakdown = useMemo(() => {
    if (breakdown) return breakdown;
    return {
      subtotal: effectiveSubtotal,
      service_fee: 0,
      payment_method_fee: 0,
      total: effectiveSubtotal,
    };
  }, [breakdown, effectiveSubtotal]);

  const isCheckoutDisabled = useMemo(() => {
    if (checkoutMutation.isPending) return true;
    if (isCartMode) {
      return cartItems.length === 0 || !selectedAddressId;
    }
    return !productId;
  }, [cartItems.length, checkoutMutation.isPending, isCartMode, productId, selectedAddressId]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Marketplace Checkout V2</h1>
          <p className="text-sm text-muted-foreground">
            {isCartMode
              ? "Cart checkout with address selection and backend order creation"
              : "Single-product checkout with backend-calculated fees"}
          </p>
        </div>
        <Link to="/marketplace">
          <Button variant="outline">Back to marketplace</Button>
        </Link>
      </div>

      {isCartMode && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cartLoading && <p className="text-sm text-muted-foreground">Loading cart...</p>}
              {!cartLoading && cartItems.length === 0 && (
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
              )}
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded bg-muted/40">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity} x {item.unitPrice.toFixed(2)} EGP
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold">{(item.unitPrice * item.quantity).toFixed(2)} EGP</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {addressesLoading && <p className="text-sm text-muted-foreground">Loading addresses...</p>}
              {!addressesLoading && addresses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No address found. Add an address first in your profile flow before cart checkout.
                </p>
              )}
              {addresses.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => setSelectedAddressId(address.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedAddressId === address.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">
                      {address.label} - {address.recipient_name}
                    </p>
                    {address.is_default && <span className="text-xs text-primary">Default</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{address.phone}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {address.governorate}, {address.city}, {address.address_line}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.code}
              onClick={() => setPaymentMethod(option.code)}
              className={`rounded-lg border p-4 text-left transition ${
                paymentMethod === option.code
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <p className="font-semibold">{option.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.note}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{effectiveBreakdown.subtotal.toFixed(2)} EGP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service fee</span>
            <span>{effectiveBreakdown.service_fee.toFixed(2)} EGP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment method fee</span>
            <span>{effectiveBreakdown.payment_method_fee.toFixed(2)} EGP</span>
          </div>
          <div className="border-t pt-2">
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{effectiveBreakdown.total.toFixed(2)} EGP</span>
            </div>
          </div>
          <div className="pt-2">
            <Button className="w-full" onClick={() => checkoutMutation.mutate()} disabled={isCheckoutDisabled}>
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating order
                </>
              ) : isCartMode ? (
                "Create orders from cart"
              ) : (
                "Create order"
              )}
            </Button>

            {isCartMode && addresses.length === 0 && (
              <p className="mt-2 text-xs text-destructive">Add at least one address to continue.</p>
            )}
            {!isCartMode && !productId && (
              <p className="mt-2 text-xs text-destructive">
                Missing product id in URL. Open checkout from product landing.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {createdCartOrders > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cart Checkout Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Successfully created <span className="font-semibold">{createdCartOrders}</span> order(s).
            </p>
            {isManualMethod && (
              <p className="text-muted-foreground">
                Manual payment selected. Upload receipt(s) from your orders details after transfer.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {orderId && isManualMethod && !isCartMode && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Transfer Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sender-phone">Sender phone</Label>
                <Input
                  id="sender-phone"
                  value={senderPhone}
                  onChange={(event) => setSenderPhone(event.target.value)}
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-reference">Transfer reference</Label>
                <Input
                  id="transfer-reference"
                  value={transferReference}
                  onChange={(event) => setTransferReference(event.target.value)}
                  placeholder="Optional reference"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt-url">Receipt image URL</Label>
              <Input
                id="receipt-url"
                value={receiptImageUrl}
                onChange={(event) => setReceiptImageUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <Button
              onClick={() => submitReceiptMutation.mutate()}
              disabled={submitReceiptMutation.isPending || !receiptImageUrl}
            >
              {submitReceiptMutation.isPending ? "Submitting..." : "Submit receipt"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
