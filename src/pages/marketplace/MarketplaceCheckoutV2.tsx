import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, MapPin, ShoppingCart, Trash2, Wallet } from "lucide-react";
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
    label: "الدفع عند الاستلام",
    note: "لا يلزم إرفاق إيصال تحويل",
  },
  {
    code: "vodafone_cash",
    label: "فودافون كاش",
    note: "يتم التحويل أولاً ثم رفع إيصال الدفع",
  },
  {
    code: "instapay",
    label: "إنستاباي",
    note: "يتم التحويل أولاً ثم رفع إيصال الدفع",
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

function getReadableErrorMessage(error: unknown): string {
  const fallback = "حدث خطأ غير متوقع";
  if (!error || typeof error !== "object") return fallback;

  const rawMessage = "message" in error && typeof error.message === "string" ? error.message : "";
  const msg = rawMessage.toUpperCase();

  if (msg.includes("SELF_PURCHASE_NOT_ALLOWED")) {
    return "لا يمكن شراء منتجاتك أنت. احذفها من السلة أولاً.";
  }
  if (msg.includes("OUT_OF_STOCK")) return "أحد المنتجات نفدت كميته. حدّث السلة وحاول مرة أخرى.";
  if (msg.includes("PRODUCT_NOT_ACTIVE") || msg.includes("PRODUCT_NOT_AVAILABLE")) {
    return "أحد المنتجات غير متاح الآن أو قيد المراجعة.";
  }
  if (msg.includes("PRODUCT_NOT_FOUND")) return "أحد المنتجات لم يعد موجودًا.";
  if (msg.includes("UNAUTHORIZED")) return "يجب تسجيل الدخول أولاً.";
  if (msg.includes("ADDRESS") || msg.includes("INVALID_ADDRESS")) return "عنوان التوصيل غير صالح.";
  if (msg.includes("EMPTY_CART")) return "السلة فارغة.";

  if (rawMessage.trim()) return rawMessage;
  return fallback;
}

export default function MarketplaceCheckoutV2() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const productId = searchParams.get("product") ?? "";
  const querySubtotal = Number(searchParams.get("subtotal") ?? 0);
  const isCartMode = searchParams.get("mode") === "cart" || !productId;

  const [paymentMethod, setPaymentMethod] = useState<MarketPaymentMethod>("cash_on_delivery");
  const [orderId, setOrderId] = useState<string>("");
  const [createdCartOrders, setCreatedCartOrders] = useState<number>(0);
  const [senderPhone, setSenderPhone] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [receiptImageUrl, setReceiptImageUrl] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const isManualMethod = paymentMethod === "vodafone_cash" || paymentMethod === "instapay";

  const { data: cartItems = [], isLoading: cartLoading } = useQuery({
    queryKey: ["marketplace-v2-cart-items-checkout", user?.id ?? ""],
    enabled: Boolean(user?.id) && isCartMode,
    queryFn: async () => {
      const { data: itemsRaw, error } = await supabase
        .from("market_cart_items")
        .select("id,product_id,quantity")
        .eq("user_id", user!.id);
      if (error) throw error;
      const items = (itemsRaw ?? []) as Array<{
        id: string;
        product_id: string;
        quantity: number | null;
      }>;
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
        title: productMap.get(item.product_id)?.title ?? "منتج غير معروف",
        unitPrice: productMap.get(item.product_id)?.price ?? 0,
        image: productMap.get(item.product_id)?.image,
      }));
    },
  });

  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ["marketplace-v2-addresses-checkout", user?.id ?? ""],
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
        if (!selectedAddressId) throw new Error("اختر عنوان التوصيل أولاً");
        return createMarketCheckoutFromCart(selectedAddressId, paymentMethod);
      }
      if (!productId) throw new Error("معرّف المنتج غير موجود");
      return createMarketCheckoutOrder(productId, paymentMethod);
    },
    onSuccess: (result) => {
      if (isCartMode) {
        const createdCount = Number(result ?? 0);
        setCreatedCartOrders(createdCount);
        setOrderId("");
        toast({
        title: "تم إتمام شراء السلة",
        description: `تم إنشاء ${createdCount} طلب/طلبات من السلة.`,
        });
        return;
      }

      const createdOrderId = String(result);
      setOrderId(createdOrderId);
      setCreatedCartOrders(0);
      toast({
        title: "تم إنشاء الطلب",
        description: `تم إنشاء الطلب #${createdOrderId.slice(0, 8)} بنجاح.`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "فشلت عملية إنشاء الطلب",
        description: getReadableErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const submitReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("أنشئ الطلب أولاً");
      if (!receiptFile) throw new Error("يرجى اختيار صورة الإيصال أولاً");
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");

      const filePath = `${user.id}/${crypto.randomUUID()}-${receiptFile.name}`;
      const { error: uploadError } = await supabase.storage.from("market_receipts").upload(filePath, receiptFile);
      if (uploadError) throw uploadError;
      const storedReceiptPath = `market_receipts:${filePath}`;
      setReceiptImageUrl(storedReceiptPath);

      return submitMarketManualPaymentReceipt({
        orderId,
        paymentMethod: paymentMethod as "vodafone_cash" | "instapay",
        senderPhone,
        transferReference,
        receiptImageUrl: storedReceiptPath,
      });
    },
    onSuccess: () => {
      toast({
        title: "تم إرسال الإيصال",
        description: "جاري مراجعته من قبل الإدارة.",
      });
      setReceiptFile(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل إرسال الإيصال",
        description: getReadableErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const removeCartItemMutation = useMutation({
    mutationFn: async (cartItemId: string) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولا.");
      const { error } = await supabase
        .from("market_cart_items")
        .delete()
        .eq("id", cartItemId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-v2-cart-items-checkout", user?.id ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      toast({
        title: "تمت إزالة المنتج",
        description: "تم حذف المنتج من السلة بنجاح.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "تعذر حذف المنتج من السلة",
        description: getReadableErrorMessage(error),
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
    <div dir="rtl" className="mx-auto max-w-4xl space-y-6 text-right">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{"إتمام الشراء"}</h1>
          <p className="text-sm text-muted-foreground">
            {isCartMode
              ? "إتمام السلة مع اختيار العنوان وإنشاء الطلب من الباك إند"
              : "إتمام طلب منتج واحد برسوم محسوبة من الباك إند"}
          </p>
        </div>
        <Link to="/marketplace">
          <Button variant="outline" className="border-navy/30">{"الرجوع إلى السوق"}</Button>
        </Link>
      </div>

      {isCartMode && (
        <>
          <Card className="border-navy/20 shadow-hard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {"عناصر السلة"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cartLoading && <p className="text-sm text-muted-foreground">{"جاري تحميل السلة..."}</p>}
              {!cartLoading && cartItems.length === 0 && (
                <p className="text-sm text-muted-foreground">{"السلة فارغة."}</p>
              )}
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-navy/20 p-3 shadow-hard-sm"
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
                        {"الكمية"} {item.quantity} x {item.unitPrice.toFixed(2)} {"ج.م"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{(item.unitPrice * item.quantity).toFixed(2)} {"ج.م"}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeCartItemMutation.mutate(item.id)}
                      disabled={removeCartItemMutation.isPending}
                      aria-label="إزالة المنتج من السلة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-navy/20 shadow-hard">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {"عنوان التوصيل"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {addressesLoading && <p className="text-sm text-muted-foreground">{"جاري تحميل العناوين..."}</p>}
              {!addressesLoading && addresses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {"لا يوجد عنوان. أضف عنوانًا أولاً من صفحة الملف قبل إتمام الشراء."}
                </p>
              )}
              {addresses.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => setSelectedAddressId(address.id)}
                  className={`w-full rounded-xl border p-3 text-right transition shadow-hard-sm ${
                    selectedAddressId === address.id
                      ? "border-primary bg-primary/10"
                      : "border-navy/20 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">
                      {address.label} - {address.recipient_name}
                    </p>
                    {address.is_default && <span className="text-xs text-primary">{"افتراضي"}</span>}
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

      <Card className="border-navy/20 shadow-hard">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {"طريقة الدفع"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.code}
              onClick={() => setPaymentMethod(option.code)}
              className={`rounded-xl border p-4 text-right transition shadow-hard-sm ${
                paymentMethod === option.code
                  ? "border-primary bg-primary/10"
                  : "border-navy/20 hover:border-primary/40"
              }`}
            >
              <p className="font-semibold">{option.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.note}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="border-navy/20 shadow-hard">
        <CardHeader>
          <CardTitle>{"ملخص الطلب"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"المجموع الفرعي"}</span>
            <span>{effectiveBreakdown.subtotal.toFixed(2)} {"ج.م"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"رسوم الخدمة"}</span>
            <span>{effectiveBreakdown.service_fee.toFixed(2)} {"ج.م"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{"رسوم طريقة الدفع"}</span>
            <span>{effectiveBreakdown.payment_method_fee.toFixed(2)} {"ج.م"}</span>
          </div>
          <div className="border-t pt-2">
            <div className="flex justify-between text-base font-semibold">
              <span>{"الإجمالي"}</span>
              <span>{effectiveBreakdown.total.toFixed(2)} {"ج.م"}</span>
            </div>
          </div>
          <div className="pt-2">
            <Button className="w-full" onClick={() => checkoutMutation.mutate()} disabled={isCheckoutDisabled}>
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {"جاري إنشاء الطلب"}
                </>
              ) : isCartMode ? (
                "إنشاء طلبات من السلة"
              ) : (
                "إنشاء طلب"
              )}
            </Button>

            {isCartMode && addresses.length === 0 && (
              <p className="mt-2 text-xs text-destructive">{"أضف عنوانًا واحدًا على الأقل للمتابعة."}</p>
            )}
            {!isCartMode && !productId && (
              <p className="mt-2 text-xs text-destructive">
                {"معرّف المنتج غير موجود في الرابط."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {createdCartOrders > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{"نتيجة شراء السلة"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              {"تم إنشاء "}
              <span className="font-semibold">{createdCartOrders}</span>
              {" طلب/طلبات بنجاح."}
            </p>
            {isManualMethod && (
              <p className="text-muted-foreground">
                {"تم اختيار الدفع اليدوي. ارفع الإيصال من تفاصيل طلباتك بعد التحويل."}
              </p>
            )}
            <div className="pt-2">
              <Link to="/marketplace/orders">
                <Button variant="outline">{"اذهب إلى طلباتي"}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {orderId && !isCartMode && (
        <Card>
          <CardHeader>
            <CardTitle>{"تم إنشاء الطلب بنجاح"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              {"رقم الطلب: "}
              <span className="font-semibold">{orderId.slice(0, 8)}...</span>
            </p>
            <Link to="/marketplace/orders">
              <Button variant="outline">{"اذهب إلى طلباتي"}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {orderId && isManualMethod && !isCartMode && (
        <Card>
          <CardHeader>
            <CardTitle>{"إيصال تحويل يدوي"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sender-phone">{"هاتف المرسل"}</Label>
                <Input
                  id="sender-phone"
                  value={senderPhone}
                  onChange={(event) => setSenderPhone(event.target.value)}
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-reference">{"رقم العملية (الرقم المرجعي للتحويل)"}</Label>
                <Input
                  id="transfer-reference"
                  value={transferReference}
                  onChange={(event) => setTransferReference(event.target.value)}
                  placeholder="اكتب رقم العملية مثل: TRX123456789"
                />
                <p className="text-xs text-muted-foreground">
                  {"هو رقم العملية الظاهر في إنستاباي أو في رسالة فودافون كاش (اختياري)."}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt-file">{"رفع صورة الإيصال"}</Label>
              <Input
                id="receipt-file"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  setReceiptFile(event.target.files?.[0] ?? null);
                  setReceiptImageUrl("");
                }}
              />
              <p className="text-xs text-muted-foreground">
                {receiptFile
                  ? `الملف المحدد: ${receiptFile.name}`
                  : "اختر ملف صورة للإيصال، ثم اضغط إرسال الإيصال."}
              </p>
            </div>
            <Button
              onClick={() => submitReceiptMutation.mutate()}
              disabled={submitReceiptMutation.isPending || !receiptFile}
            >
              {submitReceiptMutation.isPending ? "جاري الإرسال..." : "إرسال الإيصال"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
