import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, Flame, MessageSquare, Pin, ShieldAlert, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import {
  deleteCampusComment,
  fetchCampusComments,
  type CampusPostWithMeta,
  deleteCampusPost,
  fetchCampusPosts,
  fetchCampusStories,
  markCampusCommentVerified,
  pinCampusPost,
} from "@/backend/campusFeedApi";
import { toast } from "sonner";

function MetricCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="border-navy/20 bg-card shadow-hard-sm">
      <CardHeader className="pb-2 text-right">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span className="text-3xl font-black text-primary">{value}</span>
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

function isExpiredStory(post: CampusPostWithMeta): boolean {
  if (post.post_type !== "story") return false;
  if (!post.expires_at) return false;
  return new Date(post.expires_at).getTime() <= Date.now();
}

export default function AdminCampusFeedConsole() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"stories" | "posts">("stories");
  const [search, setSearch] = useState("");
  const [storyFilter, setStoryFilter] = useState<"all" | "active" | "expired">("all");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [pendingDeletePostId, setPendingDeletePostId] = useState<string | null>(null);
  const [pendingPinPostId, setPendingPinPostId] = useState<string | null>(null);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const [pendingVerifyCommentId, setPendingVerifyCommentId] = useState<string | null>(null);

  const {
    data: stories = [],
    isLoading: isStoriesLoading,
    isError: isStoriesError,
    error: storiesError,
    refetch: refetchStories,
  } = useQuery({
    queryKey: ["admin-campus-stories"],
    queryFn: () => fetchCampusStories(user?.id, 120, true),
    enabled: !!user?.id,
  });

  const {
    data: posts = [],
    isLoading: isPostsLoading,
    isError: isPostsError,
    error: postsError,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ["admin-campus-posts"],
    queryFn: () => fetchCampusPosts({ postType: "thread", limit: 120 }, user?.id),
    enabled: !!user?.id,
  });

  const {
    data: expandedPostComments = [],
    isLoading: isExpandedPostCommentsLoading,
    isError: isExpandedPostCommentsError,
    error: expandedPostCommentsError,
    refetch: refetchExpandedPostComments,
  } = useQuery({
    queryKey: ["admin-campus-comments", expandedPostId],
    queryFn: async () => {
      if (!expandedPostId) return [];
      return fetchCampusComments(expandedPostId);
    },
    enabled: !!expandedPostId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      await deleteCampusPost(postId);
    },
    onMutate: (postId) => {
      setPendingDeletePostId(postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campus-stories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-campus-posts"] });
      queryClient.invalidateQueries({ queryKey: ["campus-stories"] });
      queryClient.invalidateQueries({ queryKey: ["campus-feed"] });
      toast.success("تم حذف المحتوى");
    },
    onSettled: () => {
      setPendingDeletePostId(null);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "تعذر حذف المحتوى");
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ postId, pin }: { postId: string; pin: boolean }) => {
      if (!user?.id) throw new Error("يجب تسجيل دخول الأدمن");
      await pinCampusPost(postId, user.id, pin);
    },
    onMutate: ({ postId }) => {
      setPendingPinPostId(postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campus-posts"] });
      queryClient.invalidateQueries({ queryKey: ["campus-feed"] });
      toast.success("تم تحديث التثبيت");
    },
    onSettled: () => {
      setPendingPinPostId(null);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث التثبيت");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await deleteCampusComment(commentId);
    },
    onMutate: (commentId) => {
      setPendingDeleteCommentId(commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campus-comments", expandedPostId] });
      queryClient.invalidateQueries({ queryKey: ["admin-campus-posts"] });
      queryClient.invalidateQueries({ queryKey: ["campus-feed"] });
      toast.success("تم حذف التعليق");
    },
    onSettled: () => {
      setPendingDeleteCommentId(null);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "تعذر حذف التعليق");
    },
  });

  const verifyCommentMutation = useMutation({
    mutationFn: async ({ commentId, verify }: { commentId: string; verify: boolean }) => {
      if (!user?.id) throw new Error("يجب تسجيل دخول الأدمن");
      await markCampusCommentVerified(commentId, user.id, verify);
    },
    onMutate: ({ commentId }) => {
      setPendingVerifyCommentId(commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-campus-comments", expandedPostId] });
      queryClient.invalidateQueries({ queryKey: ["admin-campus-posts"] });
      queryClient.invalidateQueries({ queryKey: ["campus-feed"] });
      toast.success("تم تحديث حالة التعليق");
    },
    onSettled: () => {
      setPendingVerifyCommentId(null);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث حالة التعليق");
    },
  });

  const stats = useMemo(() => {
    const expiredStories = stories.filter((story) => isExpiredStory(story)).length;
    const pinnedPosts = posts.filter((post) => post.is_pinned).length;
    const pollPosts = posts.filter((post) => Boolean(post.poll)).length;
    const totalStoryReactions = stories.reduce((sum, story) => sum + Number(story.story_reactions?.total_reactions ?? 0), 0);
    return {
      stories: stories.length,
      expiredStories,
      posts: posts.length,
      pinnedPosts,
      pollPosts,
      totalStoryReactions,
    };
  }, [stories, posts]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      if (storyFilter === "active" && isExpiredStory(story)) return false;
      if (storyFilter === "expired" && !isExpiredStory(story)) return false;
      if (!normalizedSearch) return true;

      const haystack = `${story.content ?? ""} ${story.author_id}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [stories, storyFilter, normalizedSearch]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (!normalizedSearch) return true;
      const haystack = `${post.content ?? ""} ${post.author_id}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [posts, normalizedSearch]);

  const resetFilters = () => {
    setSearch("");
    setStoryFilter("all");
  };

  const handleDeleteContent = (postId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المحتوى نهائيًا؟")) return;
    deleteMutation.mutate(postId);
  };

  const handleDeleteComment = (commentId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا التعليق؟")) return;
    deleteCommentMutation.mutate(commentId);
  };

  return (
    <motion.div dir="rtl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="rounded-3xl border border-navy/20 bg-card p-5 shadow-hard">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          <ShieldAlert className="h-4 w-4" />
          مركز إدارة مجتمع الجامعة
        </div>
        <h1 className="text-3xl font-black text-primary">لوحة تحكم مجتمع الجامعة</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          حذف فوري، مراجعة المحتوى، وتثبيت المنشورات المهمة من مكان واحد.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="إجمالي الستوري" value={stats.stories} icon={<MessageSquare size={18} />} />
        <MetricCard title="ستوري منتهية" value={stats.expiredStories} icon={<Trash2 size={18} />} />
        <MetricCard title="إجمالي البوستات" value={stats.posts} icon={<Flame size={18} />} />
        <MetricCard title="بوستات مثبتة" value={stats.pinnedPosts} icon={<Pin size={18} />} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricCard title="بوستات بتصويت" value={stats.pollPosts} icon={<BarChart3 size={18} />} />
        <MetricCard title="إجمالي تفاعلات الستوري" value={stats.totalStoryReactions} icon={<Flame size={18} />} />
      </div>

      <Card className="border-navy/20 bg-card shadow-hard">
        <CardHeader>
          <CardTitle className="text-right">أدوات المراقبة السريعة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="md:col-span-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="بحث بالمحتوى أو معرف المستخدم"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={activeTab === "stories" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setActiveTab("stories")}
              >
                الستوري
              </Button>
              <Button
                variant={activeTab === "posts" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setActiveTab("posts")}
              >
                البوستات
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs">
            <span className="font-bold text-muted-foreground">
              {activeTab === "stories"
                ? `نتائج الستوري: ${filteredStories.length} / ${stories.length}`
                : `نتائج البوستات: ${filteredPosts.length} / ${posts.length}`}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={resetFilters} disabled={!search && storyFilter === "all"}>
                مسح الفلاتر
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (activeTab === "stories") {
                    refetchStories();
                    return;
                  }
                  refetchPosts();
                }}
              >
                تحديث
              </Button>
            </div>
          </div>

          {activeTab === "stories" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={storyFilter === "all" ? "default" : "outline"}
                  onClick={() => setStoryFilter("all")}
                >
                  الكل
                </Button>
                <Button
                  size="sm"
                  variant={storyFilter === "active" ? "default" : "outline"}
                  onClick={() => setStoryFilter("active")}
                >
                  نشطة
                </Button>
                <Button
                  size="sm"
                  variant={storyFilter === "expired" ? "default" : "outline"}
                  onClick={() => setStoryFilter("expired")}
                >
                  منتهية
                </Button>
              </div>

              {isStoriesError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <p>{storiesError instanceof Error ? storiesError.message : "تعذر تحميل الستوري"}</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => refetchStories()}>
                    إعادة المحاولة
                  </Button>
                </div>
              ) : null}

              {isStoriesLoading ? (
                <p className="text-sm text-muted-foreground">جاري تحميل الستوري...</p>
              ) : filteredStories.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد ستوري مطابقة.</p>
              ) : (
                <div className="space-y-2">
                  {filteredStories.map((story) => (
                    <div key={story.id} className="rounded-xl border border-navy/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="line-clamp-2 text-sm font-bold">{story.content ?? "ستوري بدون نص"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatTimeAgo(story.created_at)} • {story.author_profile?.full_name?.trim() || "طالب"} • {story.author_profile?.university?.trim() || "جامعة غير محددة"}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            التفاعلات: {story.story_reactions?.total_reactions ?? 0}
                            {" • "}❤️ {story.story_reactions?.counts?.like ?? 0}
                            {" • "}🔥 {story.story_reactions?.counts?.fire ?? 0}
                            {" • "}😂 {story.story_reactions?.counts?.laugh ?? 0}
                            {" • "}👏 {story.story_reactions?.counts?.clap ?? 0}
                            {" • "}😮 {story.story_reactions?.counts?.wow ?? 0}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isExpiredStory(story) ? "destructive" : "secondary"}>
                            {isExpiredStory(story) ? "منتهية" : "نشطة"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteContent(story.id)}
                            disabled={pendingDeletePostId === story.id}
                          >
                            {pendingDeletePostId === story.id ? "جاري الحذف..." : "حذف"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {isPostsError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <p>{postsError instanceof Error ? postsError.message : "تعذر تحميل البوستات"}</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => refetchPosts()}>
                    إعادة المحاولة
                  </Button>
                </div>
              ) : null}

              {isPostsLoading ? (
                <p className="text-sm text-muted-foreground">جاري تحميل البوستات...</p>
              ) : filteredPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد بوستات مطابقة.</p>
              ) : (
                <div className="space-y-2">
                  {filteredPosts.map((post) => (
                    <div key={post.id} className="rounded-xl border border-navy/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="line-clamp-2 text-sm font-bold">{post.content ?? "بوست بدون نص"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatTimeAgo(post.created_at)} • {post.author_profile?.full_name?.trim() || "طالب"} • {post.author_profile?.university?.trim() || "جامعة غير محددة"}
                          </p>
                          {post.poll ? (
                            <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5">
                              <p className="text-[11px] font-bold text-primary">تصويت: {post.poll.question}</p>
                              <p className="text-[10px] text-muted-foreground">إجمالي التصويتات: {post.poll.total_votes}</p>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {post.is_pinned ? <Badge variant="secondary">مثبت</Badge> : null}
                          {post.poll ? <Badge variant="outline">Poll</Badge> : null}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => pinMutation.mutate({ postId: post.id, pin: !post.is_pinned })}
                            disabled={pendingPinPostId === post.id}
                          >
                            {pendingPinPostId === post.id
                              ? "جاري التحديث..."
                              : post.is_pinned
                                ? "فك التثبيت"
                                : "تثبيت"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteContent(post.id)}
                            disabled={pendingDeletePostId === post.id}
                          >
                            {pendingDeletePostId === post.id ? "جاري الحذف..." : "حذف"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setExpandedPostId((current) => (current === post.id ? null : post.id))}
                          >
                            {expandedPostId === post.id ? "إغلاق التعليقات" : "مراجعة التعليقات"}
                          </Button>
                        </div>
                      </div>

                      {expandedPostId === post.id ? (
                        <div className="mt-3 rounded-xl border border-border bg-background/60 p-2.5">
                          {isExpandedPostCommentsError ? (
                            <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                              <p>
                                {expandedPostCommentsError instanceof Error
                                  ? expandedPostCommentsError.message
                                  : "تعذر تحميل التعليقات"}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-1 h-7 px-2 text-[10px]"
                                onClick={() => refetchExpandedPostComments()}
                              >
                                إعادة المحاولة
                              </Button>
                            </div>
                          ) : null}

                          {isExpandedPostCommentsLoading ? (
                            <p className="text-xs text-muted-foreground">جاري تحميل التعليقات...</p>
                          ) : expandedPostComments.length === 0 ? (
                            <p className="text-xs text-muted-foreground">لا توجد تعليقات على هذا البوست</p>
                          ) : (
                            <div className="space-y-1.5">
                              {expandedPostComments.map((comment) => (
                                <div key={comment.id} className="rounded-lg border border-border bg-card p-2">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-bold text-foreground">
                                      {comment.parent_comment_id ? "↳ رد" : "تعليق"}
                                    </p>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant={comment.is_verified_answer ? "secondary" : "outline"}
                                        className="h-7 px-2 text-[10px]"
                                        onClick={() => verifyCommentMutation.mutate({ commentId: comment.id, verify: !comment.is_verified_answer })}
                                        disabled={pendingVerifyCommentId === comment.id}
                                      >
                                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                        {pendingVerifyCommentId === comment.id
                                          ? "جاري..."
                                          : comment.is_verified_answer
                                            ? "إلغاء التوثيق"
                                            : "توثيق"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 px-2 text-[10px]"
                                        onClick={() => handleDeleteComment(comment.id)}
                                        disabled={pendingDeleteCommentId === comment.id}
                                      >
                                        {pendingDeleteCommentId === comment.id ? "جاري الحذف..." : "حذف"}
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="whitespace-pre-wrap text-xs leading-6 text-foreground/90">{comment.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
