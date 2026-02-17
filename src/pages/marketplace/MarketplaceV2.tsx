import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Search, ShoppingCart, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProductCardItem = {
  id: string;
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

const CATEGORIES = ["all", "Medical", "Engineering", "Tech", "Scrap"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];
type StockFilter = "all" | "in_stock" | "out_of_stock";
type SortBy = "featured_latest" | "latest" | "price_asc" | "price_desc";

export default function MarketplaceV2() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("featured_latest");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["marketplace-v2-products"],
    queryFn: async () => {
      const query = supabase
        .from("products")
        .select(
          "id,title,description,price,image_url,category,stock_qty,is_featured,condition,product_condition,listing_status,moderation_status,created_at"
        )
        .eq("listing_status", "active")
        .eq("moderation_status", "approved")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ProductCardItem[];
    },
  });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;

    return products.filter((item) => {
      const title = item.title?.toLowerCase() ?? "";
      const description = item.description?.toLowerCase() ?? "";
      const category = item.category?.toLowerCase() ?? "";
      const stock = item.stock_qty ?? 0;
      const matchSearch = title.includes(q) || description.includes(q) || category.includes(q);
      const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchStock =
        stockFilter === "all" ||
        (stockFilter === "in_stock" && stock > 0) ||
        (stockFilter === "out_of_stock" && stock <= 0);
      return matchSearch && matchCategory && matchStock;
    });
  }, [categoryFilter, products, search, stockFilter]);

  const sortedProducts = useMemo(() => {
    const copy = [...filteredProducts];
    if (sortBy === "latest") return copy;

    if (sortBy === "price_asc") {
      return copy.sort((a, b) => Number(a.price) - Number(b.price));
    }

    if (sortBy === "price_desc") {
      return copy.sort((a, b) => Number(b.price) - Number(a.price));
    }

    return copy.sort((a, b) => {
      if (a.is_featured === b.is_featured) return 0;
      return a.is_featured ? -1 : 1;
    });
  }, [filteredProducts, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketplace V2</h1>
          <p className="text-sm text-muted-foreground">
            Clean rebuild powered by backend business rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/marketplace/legacy">
            <Button variant="outline">Legacy View</Button>
          </Link>
          <Link to="/marketplace/checkout?mode=cart">
            <Button className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Checkout Cart
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, description, or category"
          className="pl-10"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <Button
              key={category}
              variant={categoryFilter === category ? "default" : "outline"}
              onClick={() => setCategoryFilter(category)}
              size="sm"
              className="rounded-full"
            >
              {category === "all" ? "All Categories" : category}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={stockFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStockFilter("all")}
          >
            All Stock
          </Button>
          <Button
            variant={stockFilter === "in_stock" ? "default" : "outline"}
            size="sm"
            onClick={() => setStockFilter("in_stock")}
          >
            In Stock
          </Button>
          <Button
            variant={stockFilter === "out_of_stock" ? "default" : "outline"}
            size="sm"
            onClick={() => setStockFilter("out_of_stock")}
          >
            Out of Stock
          </Button>
        </div>

        <div className="max-w-xs">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured_latest">Featured First</SelectItem>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-72 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedProducts.map((product) => {
            const image = product.image_url?.[0];
            const stock = product.stock_qty ?? 0;
            const displayCondition = product.product_condition || product.condition || "N/A";

            return (
              <Card
                key={product.id}
                className="overflow-hidden border-border/60 bg-card/90 transition hover:border-primary/40"
              >
                <CardHeader className="space-y-2">
                  <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted/40">
                    {image ? (
                      <img
                        src={image}
                        alt={product.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{product.category || "N/A"}</span>
                    <span>{displayCondition}</span>
                  </div>
                  <CardTitle className="line-clamp-1 text-lg">{product.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                    {product.description || "No description provided"}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{Number(product.price).toFixed(2)} EGP</span>
                    <span className={stock > 0 ? "text-green-500" : "text-destructive"}>
                      {stock > 0 ? `In stock: ${stock}` : "Out of stock"}
                    </span>
                  </div>
                  {product.is_featured && (
                    <p className="text-xs font-medium text-primary">Featured Product</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full justify-between"
                    onClick={() => navigate(`/marketplace/product/${product.id}`)}
                  >
                    Open Product Landing
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
