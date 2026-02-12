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
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
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
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          id: string
          image_url: string[] | null
          price: number
          seller_id: string
          title: string
          is_featured: boolean
        }
        Insert: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string[] | null
          price: number
          seller_id: string
          title: string
          is_featured?: boolean
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string[] | null
          price?: number
          seller_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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