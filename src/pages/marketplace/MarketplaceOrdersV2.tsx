import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, Package, Store, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  canTransitionMarketOrderStatus,
  type AppRole,
  type MarketOrderStatus,
  type MarketPaymentMethod,
} from "@/backend/contracts";
import {
  submitMarketManualPaymentReceipt,
  transitionMarketOrderStatus,
} from "@/backend/marketplaceApi";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type MarketOrderRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  quantity: number;
  status: MarketOrderStatus;
  payment_method: MarketPaymentMethod;
  payment_status: string;
  subtotal: number;
  service_fee: number;
  payment_method_fee: number;
  total_paid: number;
  notes: string | null;
  updated_at: string;
  created_at: string;
};

type ManualReceiptRow = {
  id: string;
  order_id: string;
  status: "pending" | "approved" | "rejected";
  transfer_reference: string | null;
  sender_phone: string | null;
  receipt_image_url: string;
};

const STATUS_LABELS: Record<MarketOrderStatus, string> = {
  pending_payment: "بانتظار الدفع",
  paid_held: "مدفوع (معلّق)",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  refunded: "مسترد",
};

const PAYMENT_LABELS: Record<MarketPaymentMethod, string> = {
  cash_on_delivery: "الدفع عند الاستلام",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
};

const STATUS_STYLES: Record<MarketOrderStatus, string> = {
  pending_payment: "bg-warning/10 text-warning border-warning/30",
  paid_held: "bg-primary/10 text-primary border-primary/30",
  processing: "bg-primary/10 text-primary border-primary/30",
  shipped: "bg-primary/10 text-primary border-primary/30",
  delivered: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  refunded: "bg-muted text-muted-foreground border-border",
};

const RECEIPT_STATUS_LABELS: Record<ManualReceiptRow["status"], string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

const MAIN_TIMELINE: MarketOrderStatus[] = [
  "pending_payment",
  "paid_held",
  "processing",
  "shipped",
  "delivered",
];

function getAllowedTransitions(role: AppRole, current: MarketOrderStatus): MarketOrderStatus[] {
  const candidates: MarketOrderStatus[] = [
    "pending_payment",
    "paid_held",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ];
  return candidates.filter((next) => canTransitionMarketOrderStatus(role, current, next));
}

function getTimelineStatuses(status: MarketOrderStatus): MarketOrderStatus[] {
  if (status === "cancelled") return ["pending_payment", "paid_held", "cancelled"];
  if (status === "refunded") return ["paid_held", "processing", "shipped", "delivered", "refunded"];
  return MAIN_TIMELINE;
}

function getTimelineStepState(
  timeline: MarketOrderStatus[],
  current: MarketOrderStatus,
  step: MarketOrderStatus
): "done" | "current" | "todo" {
  if (current === step) return "current";
  const currentIndex = timeline.indexOf(current);
  const stepIndex = timeline.indexOf(step);
  if (currentIndex >= 0 && stepIndex >= 0 && stepIndex < currentIndex) return "done";
  return "todo";
}

function getTransitionActionLabel(
  role: AppRole,
  from: MarketOrderStatus,
  to: MarketOrderStatus
): string {
  if (role === "seller" && from === "paid_held" && to === "processing") return "بدء التجهيز";
  if (role === "seller" && from === "processing" && to === "shipped") return "تأكيد الشحن";
  if (role === "buyer" && from === "shipped" && to === "delivered") return "تأكيد الاستلام";
  if (role === "buyer" && (from === "pending_payment" || from === "paid_held") && to === "cancelled") {
    return "إلغاء الطلب";
  }
  return `تغيير إلى: ${STATUS_LABELS[to]}`;
}

export default function MarketplaceOrdersV2() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MarketOrderStatus>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | MarketPaymentMethod>("all");
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<"vodafone_cash" | "instapay">("vodafone_cash");
  const [senderPhone, setSenderPhone] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const { data: buyerOrders = [], isLoading: buyerLoading, error: buyerOrdersError } = useQuery({
    queryKey: ["marketplace-orders-buyer", user?.id ?? ""],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_orders")
        .select("id,buyer_id,seller_id,product_id,quantity,status,payment_method,payment_status,subtotal,service_fee,payment_method_fee,total_paid,notes,updated_at,created_at")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketOrderRow[];
    },
  });

  const { data: sellerOrders = [], isLoading: sellerLoading, error: sellerOrdersError } = useQuery({
    queryKey: ["marketplace-orders-seller", user?.id ?? ""],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_orders")
        .select("id,buyer_id,seller_id,product_id,quantity,status,payment_method,payment_status,subtotal,service_fee,payment_method_fee,total_paid,notes,updated_at,created_at")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketOrderRow[];
    },
  });

  const productIds = useMemo(() => {
    const ids = new Set<string>();
    buyerOrders.forEach((row) => ids.add(row.product_id));
    sellerOrders.forEach((row) => ids.add(row.product_id));
    return Array.from(ids);
  }, [buyerOrders, sellerOrders]);

  const { data: productTitles = {}, error: productTitlesError } = useQuery({
    queryKey: ["marketplace-order-product-titles", productIds.sort().join(",")],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,title")
        .in("id", productIds);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.id, row.title])) as Record<string, string>;
    },
  });

  const buyerOrderIds = useMemo(() => buyerOrders.map((row) => row.id), [buyerOrders]);

  const { data: buyerReceiptsByOrder = {}, error: buyerReceiptsError } = useQuery({
    queryKey: ["marketplace-order-receipts-buyer", buyerOrderIds.sort().join(",")],
    enabled: buyerOrderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_manual_payment_receipts")
        .select("id,order_id,status,transfer_reference,sender_phone,receipt_image_url,created_at")
        .in("order_id", buyerOrderIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Array<ManualReceiptRow & { created_at: string }>;
      const map = new Map<string, ManualReceiptRow>();
      rows.forEach((row) => {
        if (!map.has(row.order_id)) {
          map.set(row.order_id, {
            id: row.id,
            order_id: row.order_id,
            status: row.status,
            transfer_reference: row.transfer_reference,
            sender_phone: row.sender_phone,
            receipt_image_url: row.receipt_image_url,
          });
        }
      });

      return Object.fromEntries(map.entries()) as Record<string, ManualReceiptRow>;
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (input: { orderId: string; role: AppRole; to: MarketOrderStatus }) => {
      const reason = input.role === "buyer" ? "buyer_action" : "seller_action";
      return transitionMarketOrderStatus(input.orderId, input.to, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders-buyer"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders-seller"] });
      toast.success("تم تحديث حالة الطلب");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "فشل تحديث الحالة");
    },
  });

  const receiptMutation = useMutation({
    mutationFn: async () => {
      if (!receiptOrderId) throw new Error("اختر الطلب أولًا");
      if (!receiptFile) throw new Error("اختر صورة الإيصال أولًا");
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولًا");

      const filePath = `${user.id}/${crypto.randomUUID()}-${receiptFile.name}`;
      const { error: uploadError } = await supabase.storage.from("market_receipts").upload(filePath, receiptFile);
      if (uploadError) throw uploadError;

      const storedReceiptPath = `market_receipts:${filePath}`;
      await submitMarketManualPaymentReceipt({
        orderId: receiptOrderId,
        paymentMethod: receiptPaymentMethod,
        senderPhone,
        transferReference,
        receiptImageUrl: storedReceiptPath,
      });
    },
    onSuccess: () => {
      toast.success("تم إرسال الإيصال بنجاح");
      setReceiptOrderId(null);
      setSenderPhone("");
      setTransferReference("");
      setReceiptFile(null);
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders-buyer"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-order-receipts-buyer"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "فشل إرسال الإيصال");
    },
  });

  const filterOrders = useCallback((rows: MarketOrderRow[]): MarketOrderRow[] => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const matchesPayment = paymentFilter === "all" || row.payment_method === paymentFilter;
      const title = (productTitles[row.product_id] ?? "").toLowerCase();
      const matchesQuery =
        !q ||
        row.id.toLowerCase().includes(q) ||
        row.product_id.toLowerCase().includes(q) ||
        title.includes(q);

      return matchesStatus && matchesPayment && matchesQuery;
    });
  }, [searchQuery, statusFilter, paymentFilter, productTitles]);

  const filteredBuyerOrders = useMemo(() => filterOrders(buyerOrders), [buyerOrders, filterOrders]);
  const filteredSellerOrders = useMemo(() => filterOrders(sellerOrders), [sellerOrders, filterOrders]);
  const pageError =
    buyerOrdersError || sellerOrdersError || productTitlesError || buyerReceiptsError;

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6 text-right">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-foreground">طلباتي ومبيعاتي</h1>
          <p className="text-sm text-muted-foreground">متابعة حالة الطلبات كمشتري وبائع من مكان واحد.</p>
        </div>
        <Link to="/marketplace">
          <Button variant="outline" className="interactive-lift">الرجوع إلى السوق</Button>
        </Link>
      </div>

      <Card className="border-border/80 shadow-hard rounded-2xl">
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <Input
            placeholder="بحث برقم الطلب أو اسم المنتج"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="focus-halo"
          />
          <select
            className="h-11 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | MarketOrderStatus)}
          >
            <option value="all">كل الحالات</option>
            <option value="pending_payment">{STATUS_LABELS.pending_payment}</option>
            <option value="paid_held">{STATUS_LABELS.paid_held}</option>
            <option value="processing">{STATUS_LABELS.processing}</option>
            <option value="shipped">{STATUS_LABELS.shipped}</option>
            <option value="delivered">{STATUS_LABELS.delivered}</option>
            <option value="cancelled">{STATUS_LABELS.cancelled}</option>
            <option value="refunded">{STATUS_LABELS.refunded}</option>
          </select>
          <select
            className="h-11 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as "all" | MarketPaymentMethod)}
          >
            <option value="all">كل طرق الدفع</option>
            <option value="cash_on_delivery">{PAYMENT_LABELS.cash_on_delivery}</option>
            <option value="vodafone_cash">{PAYMENT_LABELS.vodafone_cash}</option>
            <option value="instapay">{PAYMENT_LABELS.instapay}</option>
          </select>
        </CardContent>
      </Card>

      {pageError && (
        <Card className="border-destructive/40 bg-destructive/5 shadow-hard-sm">
          <CardContent className="p-4 text-sm text-destructive">
            حدث خطأ أثناء تحميل بيانات الطلبات. جرّب تحديث الصفحة أو إعادة تسجيل الدخول.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="buyer" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:w-[360px] bg-card border border-border shadow-hard-sm rounded-xl p-1">
          <TabsTrigger value="buyer" className="gap-2">
            <User className="h-4 w-4" /> كمشتري
          </TabsTrigger>
          <TabsTrigger value="seller" className="gap-2">
            <Store className="h-4 w-4" /> كبائع
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buyer">
          <OrdersList
            role="buyer"
            rows={filteredBuyerOrders}
            loading={buyerLoading}
            titles={productTitles}
            pending={transitionMutation.isPending}
            onTransition={(orderId, to) => transitionMutation.mutate({ orderId, role: "buyer", to })}
            canUploadReceipt
            receiptByOrderId={buyerReceiptsByOrder}
            onOpenReceiptDialog={(orderId, paymentMethod) => {
              setReceiptOrderId(orderId);
              setReceiptPaymentMethod(paymentMethod);
            }}
          />
        </TabsContent>

        <TabsContent value="seller">
          <OrdersList
            role="seller"
            rows={filteredSellerOrders}
            loading={sellerLoading}
            titles={productTitles}
            pending={transitionMutation.isPending}
            receiptByOrderId={{}}
            onTransition={(orderId, to) => transitionMutation.mutate({ orderId, role: "seller", to })}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(receiptOrderId)} onOpenChange={(open) => !open && setReceiptOrderId(null)}>
        <DialogContent dir="rtl" className="rounded-2xl border-border shadow-hard">
          <DialogHeader>
            <DialogTitle>رفع إيصال التحويل</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sender-phone">هاتف المرسل (اختياري)</Label>
              <Input
                id="sender-phone"
                value={senderPhone}
                onChange={(event) => setSenderPhone(event.target.value)}
                placeholder="01xxxxxxxxx"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="transfer-reference">الرقم المرجعي للتحويل</Label>
              <Input
                id="transfer-reference"
                value={transferReference}
                onChange={(event) => setTransferReference(event.target.value)}
                placeholder="مثال: TRX123456789"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="receipt-file">صورة الإيصال</Label>
              <Input
                id="receipt-file"
                type="file"
                accept="image/*"
                onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <Button className="w-full" disabled={receiptMutation.isPending} onClick={() => receiptMutation.mutate()}>
              {receiptMutation.isPending ? "جاري الإرسال..." : "إرسال الإيصال"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrdersList({
  role,
  rows,
  loading,
  titles,
  pending,
  receiptByOrderId,
  onTransition,
  canUploadReceipt,
  onOpenReceiptDialog,
}: {
  role: AppRole;
  rows: MarketOrderRow[];
  loading: boolean;
  titles: Record<string, string>;
  pending: boolean;
  receiptByOrderId: Record<string, ManualReceiptRow>;
  onTransition: (orderId: string, to: MarketOrderStatus) => void;
  canUploadReceipt?: boolean;
  onOpenReceiptDialog?: (orderId: string, paymentMethod: "vodafone_cash" | "instapay") => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/70 bg-card p-8 text-muted-foreground shadow-hard-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        جاري تحميل الطلبات...
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-8 text-center text-muted-foreground shadow-hard-sm">
        لا توجد طلبات في هذا القسم حتى الآن.
      </div>
    );
  }

  const requiresManualReceipt = (row: MarketOrderRow) =>
    (row.payment_method === "vodafone_cash" || row.payment_method === "instapay") &&
    row.status === "pending_payment";

  return (
    <div className="grid gap-4">
      {rows.map((row) => {
        const allowed = getAllowedTransitions(role, row.status);
        const title = titles[row.product_id] ?? `منتج #${row.product_id.slice(0, 8)}`;
        const receipt = receiptByOrderId[row.id];

        return (
          <Card key={row.id} className="border-border/80 rounded-2xl shadow-hard pressable interactive-lift interactive-glow">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  {title}
                </span>
                <Badge variant="outline" className={STATUS_STYLES[row.status]}>
                  {STATUS_LABELS[row.status]}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 text-muted-foreground md:grid-cols-4">
                <p>رقم الطلب: {row.id.slice(0, 8)}...</p>
                <p>الكمية: {row.quantity}</p>
                <p>الطريقة: {PAYMENT_LABELS[row.payment_method]}</p>
                <p className="font-bold text-foreground">الإجمالي: {Number(row.total_paid).toFixed(2)} ج.م</p>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                <p>المجموع الفرعي: {Number(row.subtotal).toFixed(2)} ج.م</p>
                <p>رسوم الخدمة: {Number(row.service_fee).toFixed(2)} ج.م</p>
                <p>رسوم الدفع: {Number(row.payment_method_fee).toFixed(2)} ج.م</p>
                <p>حالة الدفع: {row.payment_status}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                تاريخ الإنشاء: {new Date(row.created_at).toLocaleString("ar-EG")}
              </p>
              <p className="text-xs text-muted-foreground">
                آخر تحديث: {new Date(row.updated_at).toLocaleString("ar-EG")}
              </p>
              {row.notes && <p className="text-xs text-muted-foreground">ملاحظات: {row.notes}</p>}

              <OrderStatusTimeline status={row.status} />

              {role === "buyer" && (row.payment_method === "vodafone_cash" || row.payment_method === "instapay") && (
                <div className="rounded-lg border border-border/70 bg-muted/20 p-2 text-xs">
                  <p className="font-medium">
                    حالة الإيصال: {receipt ? RECEIPT_STATUS_LABELS[receipt.status] : "لم يتم الإرسال بعد"}
                  </p>
                  {receipt?.transfer_reference && <p>الرقم المرجعي: {receipt.transfer_reference}</p>}
                  {receipt?.sender_phone && <p>هاتف المرسل: {receipt.sender_phone}</p>}
                </div>
              )}

              {allowed.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allowed.map((to) => (
                    <Button
                      key={to}
                      size="sm"
                      variant="outline"
                      className="interactive-lift"
                      disabled={pending}
                      onClick={() => onTransition(row.id, to)}
                    >
                      {pending ? "جاري..." : getTransitionActionLabel(role, row.status, to)}
                    </Button>
                  ))}
                </div>
              )}

              {canUploadReceipt && requiresManualReceipt(row) && onOpenReceiptDialog && (
                <div className="pt-1">
                  <Button
                    size="sm"
                    className="interactive-lift"
                    onClick={() => onOpenReceiptDialog(row.id, row.payment_method as "vodafone_cash" | "instapay")}
                  >
                    رفع إيصال التحويل
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function OrderStatusTimeline({ status }: { status: MarketOrderStatus }) {
  const timeline = getTimelineStatuses(status);

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-2">
      <p className="mb-2 text-xs font-medium text-muted-foreground">الخط الزمني للطلب</p>
      <div className="flex flex-wrap items-center gap-2">
        {timeline.map((step, index) => {
          const state = getTimelineStepState(timeline, status, step);
          const dotClass =
            state === "done"
              ? "bg-success"
              : state === "current"
                ? "bg-primary"
                : "bg-muted-foreground/40";
          const textClass =
            state === "done"
              ? "text-success"
              : state === "current"
                ? "text-primary"
                : "text-muted-foreground";

          return (
            <div key={step} className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                <span className={`text-[11px] ${textClass}`}>{STATUS_LABELS[step]}</span>
              </div>
              {index < timeline.length - 1 && <span className="text-muted-foreground/40">{"->"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
