export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_finances: {
        Row: {
          id: string
          amount: number
          type: "featured_ad" | "b2b_subscription" | "commission"
          seller_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          amount: number
          type: "featured_ad" | "b2b_subscription" | "commission"
          seller_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          amount?: number
          type?: "featured_ad" | "b2b_subscription" | "commission"
          seller_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_finances_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      housing: {
        Row: {
          created_at: string
          description: string | null
          gender_preference: Database["public"]["Enums"]["gender_type"] | null
          id: string
          image_url: string | null
          location: string
          poster_id: string
          price: number
          title: string
          type: Database["public"]["Enums"]["housing_type"]
          verified: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          gender_preference?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          image_url?: string | null
          location: string
          poster_id: string
          price: number
          title: string
          type?: Database["public"]["Enums"]["housing_type"]
          verified?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          gender_preference?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          image_url?: string | null
          location?: string
          poster_id?: string
          price?: number
          title?: string
          type?: Database["public"]["Enums"]["housing_type"]
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "housing_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          location: string | null
          product_id: string | null
          runner_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          location?: string | null
          product_id?: string | null
          runner_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          location?: string | null
          product_id?: string | null
          runner_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_addresses: {
        Row: {
          address_line: string
          city: string
          created_at: string
          governorate: string
          id: string
          is_default: boolean
          label: string
          notes: string | null
          phone: string
          recipient_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          city: string
          created_at?: string
          governorate: string
          id?: string
          is_default?: boolean
          label?: string
          notes?: string | null
          phone: string
          recipient_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          governorate?: string
          id?: string
          is_default?: boolean
          label?: string
          notes?: string | null
          phone?: string
          recipient_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_disputes: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          order_id: string
          reason: string
          refunded_amount: number
          resolution_note: string | null
          resolved_at: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          order_id: string
          reason: string
          refunded_amount?: number
          resolution_note?: string | null
          resolved_at?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          order_id?: string
          reason?: string
          refunded_amount?: number
          resolution_note?: string | null
          resolved_at?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_manual_payment_receipts: {
        Row: {
          admin_note: string | null
          buyer_id: string
          created_at: string
          id: string
          order_id: string
          payment_method: string
          receipt_image_url: string
          reviewed_at: string | null
          reviewed_by: string | null
          sender_phone: string | null
          status: string
          transfer_reference: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          buyer_id: string
          created_at?: string
          id?: string
          order_id: string
          payment_method: string
          receipt_image_url: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_phone?: string | null
          status?: string
          transfer_reference?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          buyer_id?: string
          created_at?: string
          id?: string
          order_id?: string
          payment_method?: string
          receipt_image_url?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_phone?: string | null
          status?: string
          transfer_reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      market_orders: {
        Row: {
          buyer_id: string
          commission_fee: number
          created_at: string
          currency: string
          delivered_at: string | null
          hold_days_snapshot: number | null
          hold_release_at: string | null
          id: string
          notes: string | null
          otp_code: string | null
          package_fee: number
          payment_method: string
          payment_method_fee: number
          payment_status: string
          product_id: string
          quantity: number
          seller_id: string
          seller_net_amount: number
          seller_tier_snapshot: string | null
          service_fee: number
          status: string
          subtotal: number
          total_paid: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          commission_fee: number
          created_at?: string
          currency?: string
          delivered_at?: string | null
          hold_days_snapshot?: number | null
          hold_release_at?: string | null
          id?: string
          notes?: string | null
          otp_code?: string | null
          package_fee?: number
          payment_method?: string
          payment_method_fee?: number
          payment_status?: string
          product_id: string
          quantity?: number
          seller_id: string
          seller_net_amount: number
          seller_tier_snapshot?: string | null
          service_fee?: number
          status?: string
          subtotal: number
          total_paid: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          commission_fee?: number
          created_at?: string
          currency?: string
          delivered_at?: string | null
          hold_days_snapshot?: number | null
          hold_release_at?: string | null
          id?: string
          notes?: string | null
          otp_code?: string | null
          package_fee?: number
          payment_method?: string
          payment_method_fee?: number
          payment_status?: string
          product_id?: string
          quantity?: number
          seller_id?: string
          seller_net_amount?: number
          seller_tier_snapshot?: string | null
          service_fee?: number
          status?: string
          subtotal?: number
          total_paid?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      market_payouts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          note: string | null
          order_id: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          order_id?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          order_id?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_seller_upgrade_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          current_tier: string
          id: string
          note: string | null
          requested_tier: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          current_tier?: string
          id?: string
          note?: string | null
          requested_tier: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          current_tier?: string
          id?: string
          note?: string | null
          requested_tier?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          id: string
          image_url: string[] | null
          listing_status: string
          moderation_status: string
          price: number
          rejection_reason: string | null
          seller_id: string
          stock_qty: number
          title: string
          is_featured: boolean
        }
        Insert: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string[] | null
          listing_status?: string
          moderation_status?: string
          price: number
          rejection_reason?: string | null
          seller_id: string
          stock_qty?: number
          title: string
          is_featured?: boolean
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string[] | null
          listing_status?: string
          moderation_status?: string
          price?: number
          rejection_reason?: string | null
          seller_id?: string
          stock_qty?: number
          title?: string
          is_featured?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          university_id: string | null
          updated_at: string
          verified_status: boolean
          wallet: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          university_id?: string | null
          updated_at?: string
          verified_status?: boolean
          wallet?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          university_id?: string | null
          updated_at?: string
          verified_status?: boolean
          wallet?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_manage_market_product: {
        Args: {
          _action?: string | null
          _product_id?: string | null
          _reason?: string | null
        }
        Returns: string
      }
      create_market_checkout_from_cart: {
        Args: {
          _address_id: string
          _payment_method?: string
        }
        Returns: number
      }
      create_market_checkout_order: {
        Args: {
          _payment_method?: string
          _product_id: string
        }
        Returns: string
      }
      get_market_checkout_breakdown: {
        Args: {
          _payment_method?: string
          _subtotal: number
        }
        Returns: {
          payment_method_fee: number
          service_fee: number
          subtotal: number
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      market_order_route: {
        Args: {
          _mode?: string | null
          _order_id: string
        }
        Returns: string
      }
      request_market_payout: {
        Args: {
          _amount?: number | null
        }
        Returns: string
      }
      request_market_seller_tier_upgrade: {
        Args: {
          _note?: string | null
          _requested_tier: string
        }
        Returns: string
      }
      review_market_manual_payment_receipt: {
        Args: {
          _admin_note?: string | null
          _approve: boolean
          _order_id: string
        }
        Returns: "pending" | "approved" | "rejected"
      }
      review_market_seller_upgrade_request: {
        Args: {
          _admin_note?: string | null
          _approve: boolean
          _request_id: string
        }
        Returns: "pending" | "approved" | "rejected"
      }
      submit_market_manual_payment_receipt: {
        Args: {
          _order_id: string
          _payment_method: string
          _receipt_image_url: string
          _sender_phone?: string | null
          _transfer_reference?: string | null
        }
        Returns: string
      }
      transition_market_order_status: {
        Args: {
          _new_status: string
          _order_id: string
          _reason?: string | null
        }
        Returns:
          | "pending_payment"
          | "paid_held"
          | "processing"
          | "shipped"
          | "delivered"
          | "cancelled"
          | "refunded"
      }
    }
    Enums: {
      app_role: "student" | "runner" | "admin" | "store"
      gender_type: "male" | "female" | "any"
      housing_type: "apartment" | "room" | "shared" | "studio"
      notification_type: "System" | "Sports" | "Market"
      order_status: "pending" | "active" | "delivered"
      product_category: "Medical" | "Engineering" | "Tech" | "Scrap"
    }
  }
}

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "runner", "admin", "store"],
      gender_type: ["male", "female", "any"],
      housing_type: ["apartment", "room", "shared", "studio"],
      notification_type: ["System", "Sports", "Market"],
      order_status: ["pending", "active", "delivered"],
      product_category: ["Medical", "Engineering", "Tech", "Scrap"],
    },
  },
} as const
