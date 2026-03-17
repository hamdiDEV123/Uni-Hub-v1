import type { Database } from "@/integrations/supabase/types";

export type GenderType = Database["public"]["Enums"]["gender_type"];

export type RoommateRequest = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  preferred_gender: GenderType | "any";
  preferred_faculty: string | null;
  sleep_schedule: "early" | "late" | "flexible";
  smoking_preference: "no" | "yes" | "either";
  budget_min: number | null;
  budget_max: number | null;
  area: string | null;
  phone: string | null;
  created_at: string;
};

export const DEFAULT_ROOMMATE_FORM = {
  title: "",
  description: "",
  preferred_gender: "any" as GenderType | "any",
  preferred_faculty: "",
  sleep_schedule: "flexible" as "early" | "late" | "flexible",
  smoking_preference: "either" as "no" | "yes" | "either",
  budget_min: "",
  budget_max: "",
  area: "",
  phone: "",
};
