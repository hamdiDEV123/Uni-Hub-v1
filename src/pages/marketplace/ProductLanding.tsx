import { useMemo, useState } from "react";
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
import { adminManageMarketProduct, type AdminProductAction } from "@/backend/marketplaceApi";

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
      return data as ProductDetails;
    },
  });

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
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
      if (!user?.id || !id) throw new Error("User or product missing");

      const { data: existing, error: existingError } = await supabase
        .from("market_cart_items")
        .select("id,quantity")
        .eq("user_id", user.id)
        .eq("product_id", id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("market_cart_items")
          .update({ quantity: (existing.quantity ?? 0) + 1 })
          .eq("id", existing.id);

        if (updateError) throw updateError;
        return;
      }

      const { error: insertError } = await supabase.from("market_cart_items").insert({
        user_id: user.id,
        product_id: id,
        quantity: 1,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast({
        title: "Added to cart",
        description: "Product was added to your cart.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cart update failed",
        description: error?.message ?? "Could not add product to cart",
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
        title: "Admin action applied",
        description: result,
      });
      await refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Admin action failed",
        description: error?.message ?? "Unexpected error",
        variant: "destructive",
      });
    },
  });

  if (!product) {
    return <div className="py-10 text-sm text-muted-foreground">Loading product...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{product.title}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              navigate(
                `/marketplace/checkout?product=${product.id}&subtotal=${Number(product.price)}`
              )
            }
          >
            Buy now
          </Button>
          <Button className="gap-2" onClick={() => addToCartMutation.mutate()}>
            <ShoppingCart className="h-4 w-4" />
            Add to cart
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-[16/10] w-full bg-muted/30">
                {activeImage ? (
                  <img src={activeImage} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No image available
                  </div>
                )}

                {hasImages && images.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      onClick={() => setImageIndex((current) => (current - 1 + images.length) % images.length)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
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
                className={`overflow-hidden rounded border ${
                  idx === imageIndex ? "border-primary" : "border-border"
                }`}
                onClick={() => setImageIndex(idx)}
              >
                <img src={image} alt={`${product.title}-${idx + 1}`} className="h-20 w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Price</span>
              <span className="font-semibold">{Number(product.price).toFixed(2)} EGP</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Category</span>
              <span>{product.category || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stock</span>
              <span>{product.stock_qty ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Listing</span>
              <span>{product.listing_status || "unknown"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Review</span>
              <span>{product.moderation_status || "unknown"}</span>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <p className="mb-1 text-xs text-muted-foreground">Description</p>
              <p>{product.description || "No description provided"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin moderation controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-reason">Reason (required for reject)</Label>
              <Input
                id="admin-reason"
                value={adminReason}
                onChange={(event) => setAdminReason(event.target.value)}
                placeholder="Add reason for moderation action"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => adminActionMutation.mutate("approve")}>Approve</Button>
              <Button variant="secondary" onClick={() => adminActionMutation.mutate("reject")}>
                Reject
              </Button>
              <Button variant="outline" onClick={() => adminActionMutation.mutate("archive")}>
                Archive
              </Button>
              <Button variant="outline" onClick={() => adminActionMutation.mutate("restore_activate")}>
                Restore/Activate
              </Button>
              <Button variant="destructive" onClick={() => adminActionMutation.mutate("delete_now")}>
                Delete now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
