import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { 
  Search, ShoppingCart, ArrowRight, Plus, Filter, 
  Heart, Star, SlidersHorizontal, X, Tag, Store, 
  Zap, ShieldCheck, LayoutGrid, List, ClipboardList
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  addMarketCartItemSecure,
  createMarketProductListingSecure,
  getVendorByUser,
  createVendor,
  getActiveAds,
  type MarketplaceAd,
} from "@/backend/marketplaceApi";

// hooks
import { useVendor } from "@/hooks/use-vendor";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type ProductCardItem = {
  id: string;
  seller_id: string;
  title: string;
  description?: string | null;
  price: number;
  image_url?: string[] | null;
  category?: string;
  stock_qty?: number;
  is_featured?: boolean;
  condition?: string | null;
  product_condition?: string | null;
};

type MyListingItem = {
  id: string;
  title: string;
  price: number;
  stock_qty: number;
  listing_status: string;
  moderation_status: string;
  rejection_reason: string | null;
};

const CATEGORIES = ["all", "Medical", "Engineering", "Tech", "Scrap"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  all: "كل التصنيفات",
  Medical: "طبي",
  Engineering: "هندسي",
  Tech: "تقني",
  Scrap: "خردة",
};
const LISTING_STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  pending_review: "قيد المراجعة",
  sold: "تم البيع",
  archived: "مؤرشف",
};
const MODERATION_STATUS_LABELS: Record<string, string> = {
  approved: "مقبول",
  pending: "معلّق",
  rejected: "مرفوض",
};
type CategoryFilter = (typeof CATEGORIES)[number];
type StockFilter = "all" | "in_stock" | "out_of_stock";
type SortBy = "featured_latest" | "latest" | "price_asc" | "price_desc";

type ProductFormData = {
  title: string;
  description: string;
  category: Exclude<CategoryFilter, "all">;
  price: string;
  stock_qty: string;
  product_condition: string;
  phone: string;
  is_negotiable: boolean;
};

const DEFAULT_FORM: ProductFormData = {
  title: "",
  description: "",
  category: "Engineering",
  price: "",
  stock_qty: "1",
  product_condition: "used",
  phone: "",
  is_negotiable: false,
};

export default function Marketplace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { vendor, isVendorLoading } = useVendor();

  const { data: ads = [], error: adsError } = useQuery<MarketplaceAd[], Error>({
    queryKey: ["marketplace-ads"],
    queryFn: getActiveAds,
  });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [priceRange, setPriceRange] = useState<{min: string, max: string}>({min: "", max: ""});
  const [sortBy, setSortBy] = useState<SortBy>("featured_latest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [form, setForm] = useState<ProductFormData>(DEFAULT_FORM);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const { data: products = [], isLoading, error: productsError } = useQuery({
    queryKey: ["marketplace-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,seller_id,title,description,price,image_url,category,stock_qty,is_featured,condition,product_condition,listing_status,moderation_status,created_at")
        .eq("listing_status", "active")
        .eq("moderation_status", "approved")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Sanitize data to prevent crashes due to type mismatches
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((item: any) => ({
        ...item,
        // Ensure numeric values
        price: Number(item.price),
        stock_qty: Number(item.stock_qty),
        // Handle image_url safely (convert string to array if needed)
        image_url: Array.isArray(item.image_url) 
          ? item.image_url 
          : typeof item.image_url === 'string' 
            ? [item.image_url] 
            : [],
      })) as ProductCardItem[];
    },
  });

  const { data: cartCount = 0 } = useQuery({
    queryKey: ["cart-count", user?.id ?? ""],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from("market_cart_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user?.id
  });

  const { data: myListings = [], isLoading: myListingsLoading, error: myListingsError } = useQuery({
    queryKey: ["marketplace-my-listings", user?.id ?? ""],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,title,price,stock_qty,listing_status,moderation_status,rejection_reason")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return (data ?? []) as MyListingItem[];
    },
  });

  useEffect(() => {
    if (productsError) toast.error("خطأ في جلب المنتجات: " + (productsError as Error).message);
    if (adsError) toast.error("خطأ في جلب الإعلانات: " + adsError.message);
    if (myListingsError) toast.error("خطأ في جلب إعلاناتي: " + (myListingsError as Error).message);
  }, [productsError, adsError, myListingsError]);
  const addToCartMutation = useMutation({
    mutationFn: async (product: ProductCardItem) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
      if (product.seller_id === user.id) throw new Error("لا يمكنك شراء منتجك الخاص");
      await addMarketCartItemSecure(product.id, 1);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      toast.success("تمت إضافة المنتج للسلة بنجاح");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "حدث خطأ أثناء إضافة المنتج للسلة")
  });

  const addProductMutation = useMutation({
    mutationFn: async () => {
      // ensure vendor profile exists before allowing listing
      if (user?.id) {
        const existing = await getVendorByUser(user.id);
        if (!existing) {
          // create a casual vendor by default (upgradeable later via dashboard)
          await createVendor(user.id, "casual", user.email || "My Shop");
        }
      }
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
      if (!form.title.trim()) throw new Error("عنوان المنتج مطلوب");
      if (!form.price || Number(form.price) <= 0) throw new Error("السعر يجب أن يكون أكبر من صفر");
      if (!form.stock_qty || Number(form.stock_qty) <= 0) throw new Error("الكمية يجب أن تكون 1 على الأقل");
      if (imageFiles.length === 0) throw new Error("يرجى رفع صورة واحدة على الأقل");

      const uploadedImages: string[] = [];
      for (const file of imageFiles) {
        const fileName = `${user.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("product_images").upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("product_images").getPublicUrl(fileName);
        uploadedImages.push(data.publicUrl);
      }

      await createMarketProductListingSecure({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        price: Number(form.price),
        stockQty: Number(form.stock_qty),
        productCondition: form.product_condition.trim() || "used",
        phone: form.phone.trim() || undefined,
        imageUrls: uploadedImages,
        isNegotiable: form.is_negotiable,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["marketplace-products"] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-my-listings"] }),
      ]);
      setIsAddDialogOpen(false);
      setForm(DEFAULT_FORM);
      setImageFiles([]);
      toast.success("تم إرسال المنتج بنجاح للمراجعة");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "حدث خطأ أثناء الإضافة");
    },
  });

  const toggleWishlist = (id: string) => {
    const newWishlist = new Set(wishlist);
    if (newWishlist.has(id)) newWishlist.delete(id);
    else newWishlist.add(id);
    setWishlist(newWishlist);
    toast.success(newWishlist.has(id) ? "تمت الإضافة للمفضلة" : "تم الحذف من المفضلة");
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter((item) => {
      const title = item.title?.toLowerCase() ?? "";
      const description = item.description?.toLowerCase() ?? "";
      const category = item.category?.toLowerCase() ?? "";
      const stock = item.stock_qty ?? 0;
      const price = Number(item.price);

      const matchSearch = !q || title.includes(q) || description.includes(q) || category.includes(q);
      const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchStock =
        stockFilter === "all" ||
        (stockFilter === "in_stock" && stock > 0) ||
        (stockFilter === "out_of_stock" && stock <= 0);
      const matchMinPrice = !priceRange.min || price >= Number(priceRange.min);
      const matchMaxPrice = !priceRange.max || price <= Number(priceRange.max);

      return matchSearch && matchCategory && matchStock && matchMinPrice && matchMaxPrice;
    });
  }, [products, search, categoryFilter, stockFilter, priceRange]);

  const sortedProducts = useMemo(() => {
    const copy = [...filteredProducts];
    if (sortBy === "latest") return copy;
    if (sortBy === "price_asc") return copy.sort((a, b) => Number(a.price) - Number(b.price));
    if (sortBy === "price_desc") return copy.sort((a, b) => Number(b.price) - Number(a.price));

    return copy.sort((a, b) => {
      if (a.is_featured === b.is_featured) return 0;
      return a.is_featured ? -1 : 1;
    });
  }, [filteredProducts, sortBy]);

  const vendorBanner = vendor ? (
    <div className="container mx-auto px-4 py-2">
      <div className="rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
        أنت تبيع حاليًا كـ <strong>{vendor.shop_name}</strong> ({vendor.type}).
        <Link to={`/marketplace/vendor/${vendor.id}`} className="underline ml-2">
          عرض المتجر
        </Link>
      </div>
    </div>
  ) : null;

  const adsBanner = ads.length ? (
    <div className="container mx-auto px-4 py-2">
      <div className="flex gap-3 overflow-x-auto">
        {ads.map((ad) => (
          <div
            key={ad.id}
            className="min-w-[180px] rounded border border-border bg-card p-2 text-xs text-center shadow-hard-sm"
          >
            إعلان من {ad.vendor_id}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-right font-sans pb-20">
      {vendorBanner}
      {adsBanner}
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 to-primary/30 border-b border-border">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="container relative z-10 mx-auto px-4 py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between lg:items-center">
            <div className="min-w-0 flex-1 space-y-4 md:max-w-[62%]">
                <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 px-3 py-1">
                 <Store className="w-3 h-3 mr-2" /> سوق الطلاب الجامعي
              </Badge>
              <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">
                 بيع واشترِ <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/80">المستلزمات</span> الجامعية بسهولة
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl">
                منصة عربية 100%. بيع وشراء الكتب والمستلزمات بين الطلاب بأمان.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                  <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-full border border-border">
                    <ShieldCheck className="text-primary w-4 h-4" /> <span className="text-xs font-bold text-foreground">دفع آمن</span>
                 </div>
                  <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-full border border-border">
                    <Zap className="text-primary w-4 h-4" /> <span className="text-xs font-bold text-foreground">توصيل سريع</span>
                 </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex w-full flex-col gap-3 md:w-auto md:shrink-0 md:self-start">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-primary text-primary-foreground font-bold gap-2 shadow-hard hover:bg-primary/90 pressable">
                <Plus className="h-5 w-5" />
                {"أضف منتج للبيع"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{"إضافة منتج جديد"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{"العنوان"}</Label>
                  <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="price">{"السعر (ج.م)"}</Label>
                    <Input id="price" type="number" min="1" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">{"الكمية"}</Label>
                    <Input id="stock" type="number" min="1" value={form.stock_qty} onChange={(e) => setForm((p) => ({ ...p, stock_qty: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{"التصنيف"}</Label>
                    <Select value={form.category} onValueChange={(value) => setForm((p) => ({ ...p, category: value as Exclude<CategoryFilter, "all"> }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Medical">{"طبي"}</SelectItem>
                        <SelectItem value="Engineering">{"هندسي"}</SelectItem>
                        <SelectItem value="Tech">{"تقني"}</SelectItem>
                        <SelectItem value="Scrap">{"خردة"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="condition">{"حالة المنتج"}</Label>
                    <Input id="condition" value={form.product_condition} onChange={(e) => setForm((p) => ({ ...p, product_condition: e.target.value }))} placeholder="جديد / مستعمل" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{"رقم الهاتف"}</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="01xxxxxxxxx" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{"الوصف"}</Label>
                  <textarea id="description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="images">{"صور المنتج"}</Label>
                  <Input id="images" type="file" multiple accept="image/*" onChange={(e) => setImageFiles(e.target.files ? Array.from(e.target.files) : [])} />
                  {imageFiles.length > 0 && <p className="text-xs text-muted-foreground">{`${imageFiles.length} ملف`}</p>}
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_negotiable} onChange={(e) => setForm((p) => ({ ...p, is_negotiable: e.target.checked }))} />
                  {"قابل للتفاوض"}
                </label>

                <Button className="w-full" onClick={() => addProductMutation.mutate()} disabled={addProductMutation.isPending}>
                  {addProductMutation.isPending ? "جاري الإرسال..." : "إرسال للمراجعة"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Link to="/marketplace/checkout?mode=cart">
            <Button variant="outline" className="w-full md:w-auto gap-2 relative">
              <ShoppingCart className="h-5 w-5" />
              {"السلة"}
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                  {cartCount}
                </span>
              )}
            </Button>
          </Link>
          <Link to="/marketplace/orders">
            <Button variant="outline" className="w-full md:w-auto gap-2">
              <ClipboardList className="h-5 w-5" />
              {"طلباتي"}
            </Button>
          </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* My Listings Summary */}
        {myListings.length > 0 && (
        <Card className="mb-8 border-border bg-card shadow-hard overflow-hidden">
        <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Tag className="w-4 h-4 text-primary"/> {"إعلاناتي النشطة"}</CardTitle>
        </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {myListings.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-hard pressable">
              <div className="space-y-1">
                  <p className="font-medium truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">{`${Number(item.price).toFixed(2)} ج.م - ${item.stock_qty}`}</p>
                {item.rejection_reason && <p className="text-xs text-destructive">{`سبب الرفض: ${item.rejection_reason}`}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px]">{LISTING_STATUS_LABELS[item.listing_status]}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${item.moderation_status === 'approved' ? 'text-success border-success/40' : 'text-warning border-warning/40'}`}>
                    {MODERATION_STATUS_LABELS[item.moderation_status]}
                  </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
        )}

        {/* Main Layout: Sidebar + Grid */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar Filters (Desktop) */}
          <aside className="hidden lg:block w-64 space-y-8 sticky top-24 h-fit">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="ابحث..." 
                className="pr-10" 
              />
            </div>

            {/* Categories */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2"><Filter className="w-4 h-4"/> التصنيفات</h3>
              <div className="space-y-2">
                {CATEGORIES.map((category) => (
                  <div key={category} className="flex items-center gap-2">
                    <Checkbox 
                      id={`cat-${category}`} 
                      checked={categoryFilter === category}
                      onCheckedChange={() => setCategoryFilter(category)}
                      className="border-border data-[state=checked]:bg-primary"
                    />
                    <label htmlFor={`cat-${category}`} className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      {CATEGORY_LABELS[category]}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-sm text-foreground">حالة المخزون</h3>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={stockFilter === "all" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setStockFilter("all")}
                >
                  الكل
                </Badge>
                <Badge
                  variant={stockFilter === "in_stock" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setStockFilter("in_stock")}
                >
                  متاح
                </Badge>
                <Badge
                  variant={stockFilter === "out_of_stock" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setStockFilter("out_of_stock")}
                >
                  غير متاح
                </Badge>
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2"><SlidersHorizontal className="w-4 h-4"/> السعر</h3>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  placeholder="من" 
                  className="bg-card border border-border text-xs h-8"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange(p => ({...p, min: e.target.value}))}
                />
                <span className="text-muted-foreground">-</span>
                <Input 
                  type="number" 
                  placeholder="إلى" 
                  className="bg-card border border-border text-xs h-8"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange(p => ({...p, max: e.target.value}))}
                />
              </div>
            </div>
          </aside>

          {/* Mobile Filters Trigger */}
          <div className="lg:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
             <Button variant="outline" onClick={() => setShowFiltersMobile(!showFiltersMobile)} className="gap-2">
               <Filter className="w-4 h-4" /> الفلاتر
             </Button>
             {/* Quick Categories for Mobile */}
             {CATEGORIES.slice(1).map(cat => (
               <Badge 
                key={cat} 
                variant={categoryFilter === cat ? "default" : "outline"} 
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
               >
                 {CATEGORY_LABELS[cat]}
               </Badge>
             ))}
          </div>

          <AnimatePresence>
            {showFiltersMobile && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="lg:hidden mb-5 rounded-2xl border border-border bg-card p-4 shadow-hard space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground">تخصيص الفلاتر</h3>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowFiltersMobile(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث..."
                    className="pr-10"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground">المخزون</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={stockFilter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStockFilter("all")}>الكل</Badge>
                    <Badge variant={stockFilter === "in_stock" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStockFilter("in_stock")}>متاح</Badge>
                    <Badge variant={stockFilter === "out_of_stock" ? "default" : "outline"} className="cursor-pointer" onClick={() => setStockFilter("out_of_stock")}>غير متاح</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="السعر من"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange((p) => ({ ...p, min: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="السعر إلى"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange((p) => ({ ...p, max: e.target.value }))}
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                    setStockFilter("all");
                    setPriceRange({ min: "", max: "" });
                  }}
                >
                  إعادة تعيين الفلاتر
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Product Grid */}
          <main className="flex-1">
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-hard">
              <p className="text-sm text-muted-foreground max-sm:w-full">
                وجدنا <span className="font-bold text-foreground">{sortedProducts.length}</span> منتج
              </p>
              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                <div className="flex bg-secondary rounded-lg p-1 gap-1">
                   <Button size="icon" variant="ghost" className={`h-7 w-7 ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : ''}`} onClick={() => setViewMode('grid')}><LayoutGrid className="w-4 h-4"/></Button>
                   <Button size="icon" variant="ghost" className={`h-7 w-7 ${viewMode === 'list' ? 'bg-primary/10 text-primary' : ''}`} onClick={() => setViewMode('list')}><List className="w-4 h-4"/></Button>
                </div>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                  <SelectTrigger className="h-9 w-[160px] bg-card border-border text-xs max-sm:w-full">
                    <SelectValue placeholder="الترتيب حسب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured_latest">{"المميزة أولاً"}</SelectItem>
                    <SelectItem value="latest">{"الأحدث"}</SelectItem>
                    <SelectItem value="price_asc">{"السعر: الأقل"}</SelectItem>
                    <SelectItem value="price_desc">{"السعر: الأعلى"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, idx) => <div key={idx} className="h-80 animate-pulse rounded-2xl bg-secondary" />)}
              </div>
            ) : (
              <div className={viewMode === 'grid' ? "grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : "space-y-4"}>
                <AnimatePresence>
                {sortedProducts.map((product) => {
                  const image = product.image_url?.[0];
                  const stock = product.stock_qty ?? 0;
                  const isWishlisted = wishlist.has(product.id);
                  const isOwnProduct = Boolean(user?.id && product.seller_id === user.id);

                  if (viewMode === 'list') {
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        key={product.id}
                        className="flex gap-4 bg-card border border-border p-4 rounded-2xl shadow-hard pressable interactive-lift interactive-glow hover:border-primary/40 transition-all group"
                      >
                         <div className="w-32 h-32 rounded-xl overflow-hidden bg-secondary flex-shrink-0 relative">
                            {image ? <img src={image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Store/></div>}
                         </div>
                         <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start">
                                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{product.title}</h3>
                                <Button size="icon" variant="ghost" onClick={() => toggleWishlist(product.id)} className="text-muted-foreground hover:text-destructive">
                                  <Heart className={`w-5 h-5 ${isWishlisted ? "fill-destructive text-destructive" : ""}`} />
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
                            </div>
                            <div className="flex items-center justify-between mt-4">
                               <div className="text-xl font-black text-foreground">{Number(product.price).toFixed(0)} <span className="text-xs text-muted-foreground">ج.م</span></div>
                               <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => navigate(`/marketplace/product/${product.id}`)}>التفاصيل</Button>
                                  <Button
                                    size="sm"
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => addToCartMutation.mutate(product)}
                                    disabled={isOwnProduct}
                                  >
                                    <ShoppingCart className="w-4 h-4 mr-2"/>
                                    {isOwnProduct ? "منتجك" : "أضف للسلة"}
                                  </Button>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    )
                  }

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                      key={product.id}
                      className="group relative bg-card rounded-3xl border border-border overflow-hidden shadow-hard pressable interactive-lift interactive-glow hover:border-primary/50 transition-all duration-base"
                    >
                      {/* Image Area */}
                      <div className="aspect-[4/3] bg-secondary relative overflow-hidden">
                        {image ? (
                          <img 
                            src={image} 
                            alt={product.title} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            loading="lazy" 
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{"لا توجد صورة"}</div>
                        )}
                        
                        {/* Badges */}
                        <div className="absolute top-3 right-3 flex flex-col gap-1">
                          {product.is_featured && <Badge className="bg-primary/90 text-primary-foreground font-bold backdrop-blur-sm">مميز</Badge>}
                          {stock <= 0 && <Badge variant="destructive">نفذت الكمية</Badge>}
                        </div>

                        {/* Quick Actions Overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-base bg-gradient-to-t from-foreground/85 to-transparent flex gap-2">
                           <Button
                            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-9 text-xs shadow-hard pressable"
                            onClick={(e) => { e.stopPropagation(); addToCartMutation.mutate(product); }}
                            disabled={isOwnProduct}
                           >
                             {isOwnProduct ? "منتجك" : "أضف للسلة"}
                           </Button>
                           <Button 
                            size="icon" 
                            className="h-9 w-9 bg-card/90 hover:bg-destructive/10 text-foreground border border-border"
                            onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                           >
                             <Heart className={`w-4 h-4 ${isWishlisted ? "fill-destructive text-destructive" : ""}`} />
                           </Button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-xs text-primary font-bold mb-1">{CATEGORY_LABELS[product.category as string] || product.category}</div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Star className="w-3 h-3 fill-primary text-primary"/> 4.8
                          </div>
                        </div>
                        
                        <h3 
                          className="font-bold text-foreground line-clamp-1 mb-2 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => navigate(`/marketplace/product/${product.id}`)}
                        >
                          {product.title}
                        </h3>
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex flex-col">
                              <span className="text-lg font-black text-foreground">{Number(product.price).toFixed(0)} <span className="text-xs font-normal text-muted-foreground">ج.م</span></span>
                              {product.product_condition === 'used' && <span className="text-[10px] text-muted-foreground">مستعمل</span>}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full hover:bg-primary/10 hover:text-primary"
                            onClick={() => navigate(`/marketplace/product/${product.id}`)}
                          >
                            <ArrowRight className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            )}
            
            {!isLoading && sortedProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-3xl bg-secondary/40 mt-4">
                <Search className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-bold text-foreground">لا توجد نتائج</h3>
                <p className="text-muted-foreground">جرّب البحث بكلمات أخرى أو تغيير الفلاتر</p>
                  <Button variant="link" onClick={() => {setSearch(""); setCategoryFilter("all"); setPriceRange({min:"", max:""});}} className="mt-2 text-primary">
                    إعادة تعيين الفلاتر
                  </Button>
               </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
