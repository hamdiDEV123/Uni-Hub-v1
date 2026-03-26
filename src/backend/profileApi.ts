import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type MinimalProfile = Pick<ProfileRow, "id" | "full_name" | "avatar_url" | "university">;

export async function fetchProfileById(userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function fetchDashboardProfileById(userId: string): Promise<{
  id: string;
  full_name: string | null;
  wallet: string | number | null;
  university: string | null;
  faculty: string | null;
  study_year: string | null;
  onboarding_completed: boolean | null;
}> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,wallet,university,faculty,study_year,onboarding_completed")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchProfileRoleById(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

export async function fetchProfilesByIds(ids: string[]): Promise<MinimalProfile[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url,university")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as MinimalProfile[];
}

export async function updateProfileById(userId: string, patch: ProfileUpdate): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

export async function updateProfileMediaUrlById(
  userId: string,
  kind: "avatar" | "cover",
  url: string
): Promise<void> {
  const patch: ProfileUpdate = kind === "avatar" ? { avatar_url: url } : { cover_url: url };
  await updateProfileById(userId, patch);
}

export async function setUniversityCardUrlById(userId: string, filePath: string): Promise<void> {
  await updateProfileById(userId, { university_card_url: filePath });
}
