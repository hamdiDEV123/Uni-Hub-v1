import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  adminManageMarketProduct,
  reviewMarketManualPaymentReceipt,
  reviewMarketPayoutRequest,
  reviewMarketSellerUpgradeRequest,
} from "@/backend/marketplaceApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ShoppingBag,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Store,
  Gavel,
  Eye,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { fadeUpItem, pageVariants, staggerContainer } from "@/lib/motion";
import type { Variants } from "framer-motion";

type AdminTab = "products" | "receipts" | "upgrades" | "payouts" | "disputes";

interface PendingProduct {
  id: string;
  title: string;
  price: number;
  category: string;
  image_url: string[]; // Standardized to array
  seller: { full_name: string | null; university_id: string | null } | null;
}

interface UpgradeRequestRow {
  id: string;
  user_id: string;
  current_tier: string;
  requested_tier: string;
  note: string | null;
  status: string;
  profile: { full_name: string | null } | null;
}

interface PayoutRequestRow {
  id: string;
  seller_id: string;
  amount: number;
  currency: string;
  status: string;
  profile: { full_name: string | null; wallet: number | null } | null;
}

interface ReceiptRequestRow {
  id: string;
  order_id: string;
  payment_method: string;
  receipt_image_url: string;
  receipt_link: string;
  sender_phone: string | null;
  transfer_reference: string | null;
  status: string;
  buyer: { full_name: string | null } | null;
}

const SECTION_TO_TAB: Record<string, AdminTab> = {
  products: "products",
  receipts: "receipts",
  upgrades: "upgrades",
  payouts: "payouts",
  disputes: "disputes",
};

function normalizeTab(value: string | null): AdminTab {
  if (!value) return "products";
  return SECTION_TO_TAB[value] ?? "products";
}

// FIXME: This function exists because data in DB is likely double-stringified.
// Ideally, run a migration to fix data in DB and remove this function.
function normalizeText(value: string | null | undefined): string {
  if (!value) return "-";
  const looksEscaped = /\\?u[0-9a-fA-F]{4}/.test(value);
  if (!looksEscaped) return value;

  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

const BADGE_COLORS = {
  blue: "bg-primary/10 text-primary",
  green: "bg-success/10 text-success",
  yellow: "bg-warning/10 text-warning",
  orange: "bg-primary/10 text-primary",
};

export default function AdminMarketplaceConsoleV2() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>(normalizeTab(searchParams.get("section")));
  const queryClient = useQueryClient();
  
  // State for Rejection Dialog
  const [rejectDialog, setRejectDialog] = useState<{ isOpen: boolean; type: 'product' | 'receipt' | 'upgrade'; id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get("section")));
  }, [searchParams]);

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pending-products"] }),
      queryClient.invalidateQueries({ queryKey: ["pending-receipts"] }),
      queryClient.invalidateQueries({ queryKey: ["upgrade-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["payout-requests"] }),
    ]);
  };

  const { data: pendingProducts = [] } = useQuery({
    queryKey: ["pending-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,title,price,category,image_url,profiles:seller_id(full_name,university_id)")
        .eq("moderation_status", "pending");

      if (error) throw error;

      // Safer mapping with optional chaining
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        price: row.price,
        category: row.category,
        // Handle image_url being string or array
        image_url: Array.isArray(row.image_url)
          ? row.image_url 
          : typeof row.image_url === 'string' 
            ? [row.image_url] // Fallback: wrap string in array
            : [],
        // Handle potential array response for single relation (Supabase quirk)
        seller: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      })) as PendingProduct[];
    },
  });

  const { data: pendingReceipts = [] } = useQuery({
    queryKey: ["pending-receipts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_manual_payment_receipts")
        .select("id,order_id,payment_method,receipt_image_url,sender_phone,transfer_reference,status,profiles:buyer_id(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data ?? []) as any[];
      const mapped = await Promise.all(
        rows.map(async (row) => {
          const rawReceipt = String(row.receipt_image_url ?? "");
          let receiptLink = rawReceipt;

          if (rawReceipt.startsWith("market_receipts:")) {
            const filePath = rawReceipt.replace("market_receipts:", "");
            const { data: signed, error: signedError } = await supabase.storage
              .from("market_receipts")
              .createSignedUrl(filePath, 60 * 60);
            if (!signedError && signed?.signedUrl) receiptLink = signed.signedUrl;
          }

          return {
            id: row.id,
            order_id: row.order_id,
            payment_method: row.payment_method,
            receipt_image_url: rawReceipt,
            receipt_link: receiptLink,
            sender_phone: row.sender_phone,
            transfer_reference: row.transfer_reference,
            status: row.status,
            buyer: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
          };
        })
      );

      return mapped as ReceiptRequestRow[];
    },
  });

  const { data: upgradeRequests = [] } = useQuery({
    queryKey: ["upgrade-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_seller_upgrade_requests")
        .select("id,user_id,current_tier,requested_tier,note,status,profiles:user_id(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        current_tier: row.current_tier,
        requested_tier: row.requested_tier,
        note: row.note,
        status: row.status,
        profile: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
      })) as UpgradeRequestRow[];
    },
  });

  const { data: payoutRequests = [] } = useQuery({
    queryKey: ["payout-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_payouts")
        .select("id,seller_id,amount,currency,status,profiles:seller_id(full_name,wallet)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((row: any) => ({
        id: row.id,
        seller_id: row.seller_id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        profile: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
      })) as PayoutRequestRow[];
    },
  });

  const productDecisionMutation = useMutation({
    mutationFn: async ({ productId, approve, reason }: { productId: string; approve: boolean; reason?: string }) => {
      if (!approve && !reason) throw new Error("يجب إدخال سبب الرفض");
      return adminManageMarketProduct(approve ? "approve" : "reject", productId, reason);
    },
    onSuccess: async () => {
      await refreshAdminData();
      toast.success("تم تطبيق القرار بنجاح");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "فشل مراجعة المنتج");
    },
  });

  const receiptDecisionMutation = useMutation({
    mutationFn: async ({ orderId, approve, reason }: { orderId: string; approve: boolean; reason?: string }) => {
      return reviewMarketManualPaymentReceipt(orderId, approve, reason);
    },
    onSuccess: async () => {
      await refreshAdminData();
      toast.success("تم مراجعة الإيصال");
    },
  });

  const upgradeDecisionMutation = useMutation({
    mutationFn: async ({ requestId, approve, reason }: { requestId: string; approve: boolean; reason?: string }) => {
      return reviewMarketSellerUpgradeRequest(requestId, approve, reason);
    },
    onSuccess: async () => {
      await refreshAdminData();
      toast.success("تم مراجعة طلب الترقية");
    },
  });

  const payoutDecisionMutation = useMutation({
    mutationFn: async ({ payoutId }: { payoutId: string }) =>
      reviewMarketPayoutRequest(payoutId, true, "Paid via admin console"),
    onSuccess: async () => {
      await refreshAdminData();
      toast.success("تم تأكيد التحويل كمدفوع");
    },
  });

  const handleRejectClick = (type: 'product' | 'receipt' | 'upgrade', id: string) => {
    setRejectDialog({ isOpen: true, type, id });
    setRejectReason("");
  };

  const confirmRejection = () => {
    if (!rejectDialog) return;

    if (rejectDialog.type === 'product') {
        if (!rejectReason.trim()) {
            toast.error("سبب الرفض مطلوب للمنتجات");
            return;
        }
        productDecisionMutation.mutate({ productId: rejectDialog.id, approve: false, reason: rejectReason });
    } else if (rejectDialog.type === 'receipt') {
        receiptDecisionMutation.mutate({ orderId: rejectDialog.id, approve: false, reason: rejectReason });
    } else if (rejectDialog.type === 'upgrade') {
        upgradeDecisionMutation.mutate({ requestId: rejectDialog.id, approve: false, reason: rejectReason });
    }

    setRejectDialog(null);
    setRejectReason("");
  };

  return (
    <motion.div dir="rtl" variants={pageVariants as Variants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUpItem as Variants} className="mb-8 flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-border/30 bg-card/70 p-5 backdrop-blur-md">
        <div>
          <span className="mb-2 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            إدارة السوق
          </span>
          <h1 className="bg-gradient-to-l from-primary to-secondary bg-clip-text text-3xl font-black text-transparent">
            {"لوحة إدارة السوق"}
          </h1>
          <p className="mt-2 text-xs font-bold tracking-widest text-muted-foreground">{"المنتجات - الإيصالات - الترقيات - السحوبات"}</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <StatBadge label="منتجات قيد المراجعة" value={pendingProducts.length} icon={<ShoppingBag size={14} />} color="blue" />
          <StatBadge label="إيصالات معلقة" value={pendingReceipts.length} icon={<Receipt size={14} />} color="yellow" />
          <StatBadge label="طلبات ترقية" value={upgradeRequests.length} icon={<TrendingUp size={14} />} color="blue" />
          <StatBadge label="سحوبات معلقة" value={payoutRequests.length} icon={<DollarSign size={14} />} color="green" />
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdminTab)} className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-xl border border-border/30 bg-card/70 p-1 backdrop-blur-md">
          <AdminTabTrigger value="products" label="مراجعة المنتجات" icon={<Eye size={16} />} count={pendingProducts.length} />
          <AdminTabTrigger value="receipts" label="إيصالات الدفع" icon={<Receipt size={16} />} count={pendingReceipts.length} />
          <AdminTabTrigger value="upgrades" label="ترقيات البائعين" icon={<Store size={16} />} count={upgradeRequests.length} />
          <AdminTabTrigger value="payouts" label="طلبات السحب" icon={<DollarSign size={16} />} count={payoutRequests.length} />
          <AdminTabTrigger value="disputes" label="النزاعات" icon={<Gavel size={16} />} />
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <motion.div variants={staggerContainer as Variants} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingProducts.map((product) => (
              <motion.div key={product.id} variants={fadeUpItem as Variants}>
                <Card className="group overflow-hidden border-border/30 bg-card/70 backdrop-blur-md">
                  <div className="relative h-48 bg-muted/30">
                    {product.image_url && product.image_url[0] && (
                      <img src={product.image_url[0]} className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" alt={product.title} />
                    )}
                    <Badge className="absolute right-2 top-2 border-warning/40 bg-warning/10 text-warning">{"معلق"}</Badge>
                  </div>
                  <div className="space-y-3 p-4 text-right">
                    <h3 className="truncate text-lg font-bold">{normalizeText(product.title)}</h3>
                    <p className="text-xl font-bold text-secondary">{product.price} EGP</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{`البائع: ${normalizeText(product.seller?.full_name)}`}</span>
                      <span>{normalizeText(product.category)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button onClick={() => productDecisionMutation.mutate({ productId: product.id, approve: true })} className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground">{"موافقة"}</Button>
                      <Button onClick={() => handleRejectClick('product', product.id)} className="border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground">{"رفض"}</Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
            {pendingProducts.length === 0 && <EmptyState msg="لا توجد منتجات معلقة" />}
          </motion.div>
        </TabsContent>

        <TabsContent value="receipts">
          <Card className="border-border/30 bg-card/70 backdrop-blur-md"><CardHeader><CardTitle className="text-right text-primary">{"إيصالات الدفع اليدوي"}</CardTitle></CardHeader><CardContent><div className="space-y-4">{pendingReceipts.map((receipt) => (<div key={receipt.id} className="flex flex-col gap-4 rounded-xl border border-border/20 bg-card/20 p-4 md:flex-row md:items-center md:justify-between"><div className="flex-1 text-right"><h4 className="text-lg font-bold">{`المشتري: ${normalizeText(receipt.buyer?.full_name)}`}</h4><p className="text-sm text-muted-foreground">{`طلب: ${receipt.order_id.slice(0,8)}...`}</p><p className="text-sm text-muted-foreground">{`الطريقة: ${normalizeText(receipt.payment_method)}`}</p><a href={receipt.receipt_link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">{"عرض الإيصال"}</a></div><div className="flex gap-2"><Button size="sm" className="bg-primary" onClick={() => receiptDecisionMutation.mutate({ orderId: receipt.order_id, approve: true })}>{"موافقة"}</Button><Button size="sm" variant="destructive" onClick={() => handleRejectClick('receipt', receipt.order_id)}>{"رفض"}</Button></div></div>))}{pendingReceipts.length === 0 && <EmptyState msg="لا توجد إيصالات معلقة" />}</div></CardContent></Card>
        </TabsContent>

        <TabsContent value="upgrades">
          <Card className="border-border/30 bg-card/70 backdrop-blur-md"><CardHeader><CardTitle className="text-right text-primary">{"طلبات ترقية البائعين"}</CardTitle></CardHeader><CardContent><div className="space-y-4">{upgradeRequests.map((request) => (<div key={request.id} className="flex flex-col gap-4 rounded-xl border border-border/20 bg-card/20 p-4 md:flex-row md:items-center md:justify-between"><div className="flex-1 text-right"><h4 className="text-lg font-bold">{normalizeText(request.profile?.full_name)}</h4><p className="text-sm text-muted-foreground">{`${normalizeText(request.current_tier)} -> ${normalizeText(request.requested_tier)}`}</p><p className="mt-1 text-xs text-muted-foreground">{normalizeText(request.note)}</p></div><div className="flex gap-2"><Button size="sm" className="bg-primary" onClick={() => upgradeDecisionMutation.mutate({ requestId: request.id, approve: true })}>{"موافقة"}</Button><Button size="sm" variant="destructive" onClick={() => handleRejectClick('upgrade', request.id)}>{"رفض"}</Button></div></div>))}{upgradeRequests.length === 0 && <EmptyState msg="لا توجد طلبات ترقية معلقة" />}</div></CardContent></Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card className="border-border/30 bg-card/70 backdrop-blur-md"><CardHeader><CardTitle className="text-right text-primary">{"طلبات السحب"}</CardTitle></CardHeader><CardContent><ScrollArea className="h-[400px]"><table className="w-full text-right"><thead className="border-b border-border/40 text-xs text-muted-foreground"><tr><th className="pb-3">{"البائع"}</th><th className="pb-3">{"المبلغ"}</th><th className="pb-3">{"الإجراء"}</th></tr></thead><tbody className="divide-y divide-border/20">{payoutRequests.map((payout) => (<tr key={payout.id}><td className="py-4 font-medium">{normalizeText(payout.profile?.full_name)}</td><td className="py-4 text-2xl font-black text-primary">{payout.amount} <span className="text-xs text-muted-foreground">{normalizeText(payout.currency)}</span></td><td className="py-4"><Button onClick={() => payoutDecisionMutation.mutate({ payoutId: payout.id })} className="h-8 rounded-lg bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90">{"تأكيد الدفع"}</Button></td></tr>))}</tbody></table>{payoutRequests.length === 0 && <EmptyState msg="لا توجد طلبات سحب" />}</ScrollArea></CardContent></Card>
        </TabsContent>

        <TabsContent value="disputes">
          <Card className="border-border/30 bg-card/70 backdrop-blur-md"><CardHeader><CardTitle className="text-right text-primary">{"النزاعات"}</CardTitle></CardHeader><CardContent><EmptyState msg="وحدة النزاعات ستتم إضافتها قريبًا" /></CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تأكيد الرفض</DialogTitle>
            <DialogDescription className="text-right">
              يرجى ذكر سبب الرفض ليتم إرساله للمستخدم.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-right">
            <Label htmlFor="reason">السبب / الملاحظة</Label>
            <Input id="reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="اكتب السبب هنا..." className="text-right" />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" onClick={confirmRejection}>تأكيد الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function AdminTabTrigger({ value, label, icon, count }: { value: AdminTab; label: string; icon: ReactNode; count?: number }) {
  return (
    <TabsTrigger value={value} className="h-10 gap-2 rounded-lg px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
      {icon} {normalizeText(label)}
      {!!count && count > 0 && <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">{count}</span>}
    </TabsTrigger>
  );
}

function StatBadge({ label, value, icon, color }: { label: string; value: number; icon: ReactNode; color: "blue" | "green" | "yellow" | "orange" }) {
  return <div className={`flex items-center gap-2 rounded-lg border border-border/30 px-3 py-1.5 ${BADGE_COLORS[color]}`}>{icon} <span className="text-xs font-bold">{normalizeText(label)}: {value}</span></div>;
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <motion.div variants={fadeUpItem as Variants} className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
      <AlertTriangle size={40} className="mb-2 opacity-50" />
      <p>{normalizeText(msg)}</p>
    </motion.div>
  );
}
