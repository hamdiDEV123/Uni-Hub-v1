import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WorkspacePageRow = Database["public"]["Tables"]["workspace_pages"]["Row"];

type WorkspacePageInsert = Database["public"]["Tables"]["workspace_pages"]["Insert"];

export interface CreateWorkspacePageInput {
  userId: string;
  parentId?: string | null;
}

export interface UpdateWorkspacePageTitleInput {
  pageId: string;
  userId: string;
  title: string;
}

export interface UpdateWorkspacePageFavoriteInput {
  pageId: string;
  userId: string;
  isFavorite: boolean;
}

export interface ArchiveWorkspacePageInput {
  pageId: string;
  userId: string;
}

export interface UpdateWorkspacePageContentInput {
  pageId: string;
  userId: string;
  content: Database["public"]["Tables"]["workspace_pages"]["Row"]["content"];
}

export async function fetchWorkspacePages(userId: string): Promise<WorkspacePageRow[]> {
  const { data, error } = await supabase
    .from("workspace_pages")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("is_favorite", { ascending: false })
    .order("position", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createWorkspacePage(input: CreateWorkspacePageInput): Promise<WorkspacePageRow> {
  const payload: WorkspacePageInsert = {
    user_id: input.userId,
    parent_id: input.parentId ?? null,
    title: "صفحة جديدة",
    content: [],
  };

  const { data, error } = await supabase
    .from("workspace_pages")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkspacePageTitle(input: UpdateWorkspacePageTitleInput): Promise<WorkspacePageRow> {
  const nextTitle = input.title.trim();
  if (!nextTitle) {
    throw new Error("العنوان لا يمكن أن يكون فارغًا");
  }

  const { data, error } = await supabase
    .from("workspace_pages")
    .update({ title: nextTitle })
    .eq("id", input.pageId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkspacePageFavorite(input: UpdateWorkspacePageFavoriteInput): Promise<WorkspacePageRow> {
  const { data, error } = await supabase
    .from("workspace_pages")
    .update({ is_favorite: input.isFavorite })
    .eq("id", input.pageId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function archiveWorkspacePage(input: ArchiveWorkspacePageInput): Promise<WorkspacePageRow> {
  const { data, error } = await supabase
    .from("workspace_pages")
    .update({ is_archived: true })
    .eq("id", input.pageId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkspacePageContent(input: UpdateWorkspacePageContentInput): Promise<WorkspacePageRow> {
  const { data, error } = await supabase
    .from("workspace_pages")
    .update({ content: input.content })
    .eq("id", input.pageId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
