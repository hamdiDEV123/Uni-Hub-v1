import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Shield, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callRpc } from "@/backend/rpc";
import {
  addMarketCartItemSecure,
  adminManageMarketProduct,
  type AdminProductAction,
  recordProductView,
} from "@/backend/marketplaceApi";

type ProductDetails = {
  id: string;
  seller_id: string;
  title: string;
  description?: string | null;
  category?: string;
  price: number;
  image_url?: string[] | null;
  stock_qty?: number;
  listing_status?: string;
  moderation_status?: string;
  rejection_reason?: string | null;
};

function normalizeImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

export default function ProductLanding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [imageIndex, setImageIndex] = useState(0);
  const [adminReason, setAdminReason] = useState("");

  const { data: product, refetch } = useQuery({
    queryKey: ["marketplace-v2-product", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,seller_id,title,description,category,price,image_url,stock_qty,listing_status,moderation_status,rejection_reason"
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return {
        ...data,
        image_url: normalizeImageUrls(data.image_url),
        price: Number(data.price ?? 0),
        stock_qty: Number(data.stock_qty ?? 0),
      } as ProductDetails;
    },
  });

  // record a view for analytics when the product is successfully loaded
  useEffect(() => {
    if (product && user?.id) {
      // fire-and-forget, failures are non-critical
      recordProductView(product.id, user.id).catch(() => {
        /* ignore */
      });
    }
  }, [product, user?.id]);

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id ?? ""],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return false;
      return callRpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
    },
  });

  const images = useMemo(() => product?.image_url ?? [], [product?.image_url]);
  const hasImages = images.length > 0;
  const activeImage = hasImages ? images[imageIndex % images.length] : "";

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !id) throw new Error("بيانات المستخدم أو المنتج غير مكتملة");
      await addMarketCartItemSecure(id, 1);
    },
    onSuccess: () => {
      toast({
        title: "تمت الإضافة للسلة",
        description: "تمت إضافة المنتج بنجاح.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل تحديث السلة",
        description: error instanceof Error ? error.message : "لم يتم إضافة المنتج",
        variant: "destructive",
      });
    },
  });

  const adminActionMutation = useMutation({
    mutationFn: async (action: AdminProductAction) => {
      return adminManageMarketProduct(action, id, adminReason || undefined);
    },
    onSuccess: async (result) => {
      toast({
        title: "تم تنفيذ إجراء الأدمن",
        description: result,
      });
      await refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل إجراء الأدمن",
        description: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  if (!product) {
    return <div className="py-10 text-sm text-muted-foreground">{"جاري تحميل المنتج..."}</div>;
  }

  return (
    <div dir="rtl" className="space-y-6 text-right">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-foreground">{product.title}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 interactive-lift border-navy/30"
            onClick={() =>
              navigate(
                `/marketplace/checkout?product=${product.id}&subtotal=${Number(product.price)}`
              )
            }
          >
            {"اشترِ الآن"}
          </Button>
          <Button variant="cta" className="gap-2 interactive-lift" onClick={() => addToCartMutation.mutate()}>
            <ShoppingCart className="h-4 w-4" />
            {"أضف للسلة"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card className="overflow-hidden rounded-2xl border-navy/20 shadow-hard">
            <CardContent className="p-0">
              <div className="relative aspect-[16/10] w-full bg-muted/30">
                {activeImage ? (
                  <img src={activeImage} alt={product.title} className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {"لا توجد صورة متاحة"}
                  </div>
                )}

                {hasImages && images.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute left-3 top-1/2 -translate-y-1/2 interactive-lift"
                      onClick={() => setImageIndex((current) => (current - 1 + images.length) % images.length)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-3 top-1/2 -translate-y-1/2 interactive-lift"
                      onClick={() => setImageIndex((current) => (current + 1) % images.length)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-5 gap-2">
            {images.map((image, idx) => (
              <button
                key={`${image}-${idx}`}
                type="button"
                className={`overflow-hidden rounded-xl border transition-all interactive-lift ${
                  idx === imageIndex ? "border-primary shadow-hard-sm" : "border-border"
                }`}
                onClick={() => setImageIndex(idx)}
              >
                <img src={image} alt={`${product.title}-${idx + 1}`} className="h-20 w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <Card className="rounded-2xl border-navy/20 shadow-hard">
          <CardHeader>
            <CardTitle>{"بيانات المنتج"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{"السعر"}</span>
              <span className="font-semibold">{Number(product.price).toFixed(2)} {"ج.م"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{"التصنيف"}</span>
              <span>{product.category || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{"المخزون"}</span>
              <span>{product.stock_qty ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{"حالة الإعلان"}</span>
              <span>{product.listing_status || "غير محدد"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{"حالة المراجعة"}</span>
              <span>{product.moderation_status || "غير محدد"}</span>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="mb-1 text-xs text-muted-foreground">{"الوصف"}</p>
              <p>{product.description || "لا يوجد وصف"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card className="border-primary/40 rounded-2xl shadow-hard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {"تحكم الأدمن في المراجعة"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-reason">{"سبب القرار (مطلوب عند الرفض)"}</Label>
              <Input
                id="admin-reason"
                value={adminReason}
                onChange={(event) => setAdminReason(event.target.value)}
                placeholder={"أضف سبباً للإجراء"}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="interactive-lift" onClick={() => adminActionMutation.mutate("approve")}>{"موافقة"}</Button>
              <Button className="interactive-lift" variant="secondary" onClick={() => adminActionMutation.mutate("reject")}>
                {"رفض"}
              </Button>
              <Button className="interactive-lift" variant="outline" onClick={() => adminActionMutation.mutate("archive")}>
                {"أرشفة"}
              </Button>
              <Button className="interactive-lift" variant="outline" onClick={() => adminActionMutation.mutate("restore_activate")}>
                {"استعادة/تفعيل"}
              </Button>
              <Button className="interactive-lift" variant="destructive" onClick={() => adminActionMutation.mutate("delete_now")}>
                {"حذف فوري"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
