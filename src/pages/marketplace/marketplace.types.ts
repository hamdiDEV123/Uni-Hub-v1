export const MARKETPLACE_CATEGORIES = ["all", "Medical", "Engineering", "Tech", "Scrap"] as const;

export type CategoryFilter = (typeof MARKETPLACE_CATEGORIES)[number];
export type StockFilter = "all" | "in_stock" | "out_of_stock";
export type SortBy = "featured_latest" | "latest" | "price_asc" | "price_desc";

export type ListingMode = "sale" | "rental" | "barter" | "service";

export type ProductCardItem = {
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

export type MyListingItem = {
  id: string;
  title: string;
  price: number;
  stock_qty: number;
  listing_status: string;
  moderation_status: string;
  rejection_reason: string | null;
};

export type ProductFormData = {
  title: string;
  description: string;
  category: Exclude<CategoryFilter, "all">;
  price: string;
  stock_qty: string;
  product_condition: string;
  phone: string;
  is_negotiable: boolean;
  listing_mode: ListingMode;
  rental_price_per_day: string;
  barter_for: string;
  service_delivery_days: string;
};

export const DEFAULT_PRODUCT_FORM: ProductFormData = {
  title: "",
  description: "",
  category: "Engineering",
  price: "",
  stock_qty: "1",
  product_condition: "used",
  phone: "",
  is_negotiable: false,
  listing_mode: "sale",
  rental_price_per_day: "",
  barter_for: "",
  service_delivery_days: "",
};
