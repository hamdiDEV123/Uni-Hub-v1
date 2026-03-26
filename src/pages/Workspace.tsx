import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare2, FilePlus2, PanelRightOpen, Plus, Star, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import {
  archiveWorkspacePage,
  createWorkspacePage,
  fetchWorkspacePages,
  updateWorkspacePageContent,
  updateWorkspacePageFavorite,
  updateWorkspacePageTitle,
  type WorkspacePageRow,
} from "@/backend/workspaceApi";

type WorkspaceBlock = {
  id: string;
  type: "paragraph" | "todo";
  text: string;
  checked?: boolean;
};

function createBlock(type: WorkspaceBlock["type"] = "paragraph"): WorkspaceBlock {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    type,
    text: "",
    ...(type === "todo" ? { checked: false } : {}),
  };
}

function normalizeBlocks(content: Json): WorkspaceBlock[] {
  if (!Array.isArray(content)) return [createBlock("paragraph")];

  const parsed = content
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const maybeId = typeof item.id === "string" ? item.id : createBlock().id;
      const maybeType = item.type === "todo" ? "todo" : "paragraph";
      const maybeText = typeof item.text === "string" ? item.text : "";
      const maybeChecked = typeof item.checked === "boolean" ? item.checked : false;

      return {
        id: maybeId,
        type: maybeType,
        text: maybeText,
        ...(maybeType === "todo" ? { checked: maybeChecked } : {}),
      } as WorkspaceBlock;
    })
    .filter((block): block is WorkspaceBlock => block !== null);

  return parsed.length ? parsed : [createBlock("paragraph")];
}

function toJsonBlocks(blocks: WorkspaceBlock[]): Json {
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    text: block.text,
    ...(block.type === "todo" ? { checked: !!block.checked } : {}),
  }));
}

function buildChildrenMap(pages: WorkspacePageRow[]) {
  const map = new Map<string | null, WorkspacePageRow[]>();

  for (const page of pages) {
    const key = page.parent_id;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)?.push(page);
  }

  for (const [, children] of map.entries()) {
    children.sort((left, right) => {
      if (left.position !== right.position) return left.position - right.position;
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });
  }

  return map;
}

export default function Workspace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [editorBlocks, setEditorBlocks] = useState<WorkspaceBlock[]>([createBlock("paragraph")]);
  const [lastSavedBlocksHash, setLastSavedBlocksHash] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const workspaceQueryKey = ["workspace-pages", user?.id ?? ""];

  const { data: pages = [], isLoading } = useQuery({
    queryKey: workspaceQueryKey,
    enabled: !!user?.id,
    queryFn: async () => fetchWorkspacePages(user!.id),
  });

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? pages[0] ?? null,
    [pages, selectedPageId]
  );

  const childrenMap = useMemo(() => buildChildrenMap(pages), [pages]);

  useEffect(() => {
    if (!pages.length) {
      setSelectedPageId(null);
      setDraftTitle("");
      return;
    }

    if (!selectedPageId || !pages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(pages[0].id);
      setDraftTitle(pages[0].title);
    }
  }, [pages, selectedPageId]);

  const createPageMutation = useMutation({
    mutationFn: async (parentId: string | null) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولًا");
      return createWorkspacePage({ userId: user.id, parentId });
    },
    onSuccess: async (createdPage) => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      setSelectedPageId(createdPage.id);
      setDraftTitle(createdPage.title);
      toast.success("تم إنشاء صفحة جديدة");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء الصفحة");
    },
  });

  const renameMutation = useMutation({
    mutationFn: async (payload: { pageId: string; title: string }) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولًا");
      return updateWorkspacePageTitle({ pageId: payload.pageId, title: payload.title, userId: user.id });
    },
    onSuccess: async (updatedPage) => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      setDraftTitle(updatedPage.title);
      toast.success("تم حفظ العنوان");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ العنوان");
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async (payload: { pageId: string; isFavorite: boolean }) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولًا");
      return updateWorkspacePageFavorite({
        pageId: payload.pageId,
        isFavorite: payload.isFavorite,
        userId: user.id,
      });
    },
    onSuccess: async (updatedPage) => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      toast.success(updatedPage.is_favorite ? "تمت الإضافة للمفضلة" : "تمت الإزالة من المفضلة");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث المفضلة");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (pageId: string) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولًا");
      return archiveWorkspacePage({ pageId, userId: user.id });
    },
    onSuccess: async (archivedPage) => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKey });
      if (selectedPageId === archivedPage.id) {
        setSelectedPageId(null);
        setDraftTitle("");
      }
      toast.success("تم حذف الصفحة");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "تعذر حذف الصفحة");
    },
  });

  const saveContentMutation = useMutation({
    mutationFn: async (payload: { pageId: string; content: Json }) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولًا");
      return updateWorkspacePageContent({ pageId: payload.pageId, content: payload.content, userId: user.id });
    },
    onSuccess: (_, variables) => {
      const nextHash = JSON.stringify(variables.content);
      setLastSavedBlocksHash(nextHash);
      setSaveStatus("saved");
    },
    onError: (error) => {
      setSaveStatus("error");
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المحتوى");
    },
  });
  const saveContent = saveContentMutation.mutate;

  useEffect(() => {
    if (!selectedPage) return;
    const normalized = normalizeBlocks(selectedPage.content);
    const hash = JSON.stringify(toJsonBlocks(normalized));
    setEditorBlocks(normalized);
    setLastSavedBlocksHash(hash);
    setSaveStatus("idle");
  }, [selectedPage]);

  useEffect(() => {
    if (!selectedPage) return;

    const content = toJsonBlocks(editorBlocks);
    const currentHash = JSON.stringify(content);
    if (currentHash === lastSavedBlocksHash) return;

    const timer = setTimeout(() => {
      setSaveStatus("saving");
      saveContent({ pageId: selectedPage.id, content });
    }, 1200);

    return () => clearTimeout(timer);
  }, [editorBlocks, lastSavedBlocksHash, saveContent, selectedPage]);

  const updateBlock = (blockId: string, updater: (block: WorkspaceBlock) => WorkspaceBlock) => {
    setEditorBlocks((previousBlocks) => previousBlocks.map((block) => (block.id === blockId ? updater(block) : block)));
    setSaveStatus("idle");
  };

  const deleteBlock = (blockId: string) => {
    setEditorBlocks((previousBlocks) => {
      const nextBlocks = previousBlocks.filter((block) => block.id !== blockId);
      return nextBlocks.length ? nextBlocks : [createBlock("paragraph")];
    });
    setSaveStatus("idle");
  };

  const renderTree = (parentId: string | null, depth = 0) => {
    const nodes = childrenMap.get(parentId) ?? [];

    return nodes.map((page) => {
      const isActive = selectedPage?.id === page.id;
      return (
        <div key={page.id} className="space-y-1">
          <div
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
              isActive
                ? "bg-primary/10 text-primary border border-primary/30 shadow-hard-sm"
                : "text-muted-foreground hover:bg-muted/40"
            }`}
            style={{ paddingRight: `${depth * 14 + 12}px` }}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedPageId(page.id);
                setDraftTitle(page.title);
              }}
              className="min-w-0 flex-1 truncate text-right font-semibold"
            >
              {page.title}
            </button>

            <div className="mr-2 flex items-center gap-1">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  createPageMutation.mutate(page.id);
                }}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                aria-label="صفحة فرعية"
                title="إنشاء صفحة فرعية"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  favoriteMutation.mutate({ pageId: page.id, isFavorite: !page.is_favorite });
                }}
                className={`rounded-lg p-1.5 transition ${
                  page.is_favorite
                    ? "text-amber-500 hover:bg-amber-500/10"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
                aria-label="تبديل المفضلة"
                title={page.is_favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
              >
                <Star className={`h-3.5 w-3.5 ${page.is_favorite ? "fill-current" : ""}`} />
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  archiveMutation.mutate(page.id);
                }}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                aria-label="حذف الصفحة"
                title="حذف الصفحة"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {renderTree(page.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="border-navy/20 shadow-hard-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-xl font-black">
            <span>مساحة العمل</span>
            <PanelRightOpen className="h-5 w-5 text-primary" />
          </CardTitle>
          <CardDescription>صفحاتك الشخصية لإدارة المحاضرات والخطط والملاحظات.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => createPageMutation.mutate(null)}
            disabled={createPageMutation.isPending || !user?.id}
          >
            <FilePlus2 className="ml-2 h-4 w-4" />
            صفحة جديدة
          </Button>

          <ScrollArea className="h-[55vh] rounded-xl border border-border bg-muted/20 p-2">
            {isLoading ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">جاري تحميل الصفحات...</p>
            ) : pages.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">لا توجد صفحات بعد. ابدأ بإنشاء صفحة جديدة.</p>
            ) : (
              <div className="space-y-1">{renderTree(null)}</div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-navy/20 shadow-hard-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-black">{selectedPage?.title ?? "اختر صفحة"}</CardTitle>
          <CardDescription>المرحلة الأولى: الهيكل الأساسي، الشجرة، وإنشاء الصفحات.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {selectedPage ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-bold text-muted-foreground">عنوان الصفحة</p>
                <Input
                  value={draftTitle || selectedPage.title}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => {
                    const nextTitle = (draftTitle || selectedPage.title).trim();
                    if (!nextTitle || nextTitle === selectedPage.title || renameMutation.isPending) return;
                    renameMutation.mutate({ pageId: selectedPage.id, title: nextTitle });
                  }}
                  placeholder="اكتب عنوان الصفحة"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => createPageMutation.mutate(selectedPage.id)}
                  disabled={createPageMutation.isPending}
                >
                  <Plus className="ml-2 h-4 w-4" />
                  صفحة فرعية
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    favoriteMutation.mutate({
                      pageId: selectedPage.id,
                      isFavorite: !selectedPage.is_favorite,
                    })
                  }
                  disabled={favoriteMutation.isPending}
                >
                  <Star className={`ml-2 h-4 w-4 ${selectedPage.is_favorite ? "fill-current text-amber-500" : ""}`} />
                  {selectedPage.is_favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => archiveMutation.mutate(selectedPage.id)}
                  disabled={archiveMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="ml-2 h-4 w-4" />
                  حذف الصفحة
                </Button>
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-semibold">محرر الملاحظات (Blocks)</p>
                  <span className="text-xs text-muted-foreground">
                    {saveStatus === "saving" && "جاري الحفظ..."}
                    {saveStatus === "saved" && "تم الحفظ"}
                    {saveStatus === "error" && "تعذر الحفظ"}
                    {saveStatus === "idle" && "تعديل محلي"}
                  </span>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditorBlocks((previous) => [...previous, createBlock("paragraph")])}
                  >
                    <Type className="ml-2 h-4 w-4" />
                    Paragraph
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditorBlocks((previous) => [...previous, createBlock("todo")])}
                  >
                    <CheckSquare2 className="ml-2 h-4 w-4" />
                    Todo
                  </Button>
                </div>

                <div className="space-y-3">
                  {editorBlocks.map((block, index) => (
                    <div key={block.id} className="flex items-start gap-2 rounded-xl border border-border bg-background/80 p-3">
                      {block.type === "todo" ? (
                        <Checkbox
                          checked={!!block.checked}
                          onCheckedChange={(checked) =>
                            updateBlock(block.id, (previousBlock) => ({
                              ...previousBlock,
                              checked: checked === true,
                            }))
                          }
                          className="mt-2"
                        />
                      ) : (
                        <span className="mt-2 text-xs text-muted-foreground">{index + 1}</span>
                      )}

                      <Input
                        value={block.text}
                        onChange={(event) =>
                          updateBlock(block.id, (previousBlock) => ({
                            ...previousBlock,
                            text: event.target.value,
                          }))
                        }
                        placeholder={block.type === "todo" ? "مهمة جديدة..." : "اكتب فقرة..."}
                      />

                      <button
                        type="button"
                        onClick={() => deleteBlock(block.id)}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        title="حذف البلوك"
                        aria-label="حذف البلوك"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">ابدأ بإنشاء صفحة جديدة من الشريط الجانبي.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
