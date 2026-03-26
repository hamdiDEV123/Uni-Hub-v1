import { ArrowDown, ArrowUp, MessageCircle } from "lucide-react";
import type { CampusCommentWithMeta, CampusPostCategory, CampusPostWithMeta } from "@/backend/campusFeedApi";
import { CAMPUS_CATEGORY_LABELS } from "../campusFeed.constants";

type ThreadedComment = {
  root: CampusCommentWithMeta;
  replies: CampusCommentWithMeta[];
};

type FeedPostCardProps = {
  post: CampusPostWithMeta;
  isAdmin: boolean;
  formatTimeAgo: (isoDate: string) => string;
  isCommentsOpen: boolean;
  postCommentDraft: string;
  replyTargetCommentId: string | null;
  isCommentsLoading: boolean;
  threadedComments: ThreadedComment[];
  isVotePollPending: boolean;
  isAddCommentPending: boolean;
  onTogglePin: (postId: string, pin: boolean) => void;
  onDeletePost: (postId: string) => void;
  onVotePoll: (postId: string, optionId: string) => void;
  onVotePost: (postId: string, vote: -1 | 1) => void;
  onToggleComments: (postId: string) => void;
  onSetReplyTarget: (postId: string, commentId: string | null) => void;
  onDraftChange: (postId: string, value: string) => void;
  onAddComment: (postId: string, content: string, parentCommentId?: string | null) => void;
};

export function FeedPostCard({
  post,
  isAdmin,
  formatTimeAgo,
  isCommentsOpen,
  postCommentDraft,
  replyTargetCommentId,
  isCommentsLoading,
  threadedComments,
  isVotePollPending,
  isAddCommentPending,
  onTogglePin,
  onDeletePost,
  onVotePoll,
  onVotePost,
  onToggleComments,
  onSetReplyTarget,
  onDraftChange,
  onAddComment,
}: FeedPostCardProps) {
  const postAuthorName = post.author_profile?.full_name?.trim() || "طالب";
  const postAuthorUniversity = post.author_profile?.university?.trim() || "جامعة غير محددة";
  const postAuthorAvatar = post.author_profile?.avatar_url;

  return (
    <article className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-hard-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {postAuthorAvatar ? (
            <img src={postAuthorAvatar} alt={postAuthorName} className="h-8 w-8 rounded-full border border-border object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-black text-foreground">
              {postAuthorName.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-sm font-black text-foreground">{postAuthorName}</p>
            <p className="text-[11px] text-muted-foreground">{postAuthorUniversity}</p>
          </div>
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {CAMPUS_CATEGORY_LABELS[(post.category as CampusPostCategory) ?? "general"] ?? "عام"}
          </span>
          {post.is_pinned ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600">
              مثبت
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatTimeAgo(post.created_at)}</span>
          {isAdmin ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onTogglePin(post.id, !post.is_pinned)}
                className="rounded-full border border-amber-500/40 px-2 py-1 text-[11px] font-bold text-amber-600 hover:bg-amber-500/10"
              >
                {post.is_pinned ? "فك التثبيت" : "تثبيت"}
              </button>
              <button
                type="button"
                onClick={() => onDeletePost(post.id)}
                className="rounded-full border border-red-500/40 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-500/10"
              >
                حذف
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {post.content ? <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/95">{post.content}</p> : null}

      {post.poll ? (
        <div className="mt-3 rounded-2xl border border-border bg-background/70 p-3">
          <p className="mb-2 text-sm font-black text-foreground">{post.poll.question}</p>
          <div className="space-y-2">
            {post.poll.options.map((option) => {
              const totalVotes = Math.max(0, post.poll?.total_votes ?? 0);
              const percent = totalVotes > 0 ? Math.round((option.votes_count / totalVotes) * 100) : 0;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onVotePoll(post.id, option.id)}
                  disabled={isVotePollPending}
                  className={`w-full rounded-xl border px-3 py-2 text-right text-sm transition ${
                    post.poll?.user_option_id === option.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{option.option_text}</span>
                    <span className="text-xs text-muted-foreground">{option.votes_count} • {percent}%</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">إجمالي المشاركات: {post.poll.total_votes}</p>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2.5 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => onVotePost(post.id, 1)}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition ${
            post.user_vote === 1
              ? "border-green-500/40 bg-green-500/10 text-green-600"
              : "border-border hover:border-primary/40"
          }`}
        >
          <ArrowUp className="h-3.5 w-3.5" />
          {post.upvotes_count}
        </button>
        <button
          type="button"
          onClick={() => onVotePost(post.id, -1)}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition ${
            post.user_vote === -1
              ? "border-red-500/40 bg-red-500/10 text-red-600"
              : "border-border hover:border-primary/40"
          }`}
        >
          <ArrowDown className="h-3.5 w-3.5" />
          {post.downvotes_count}
        </button>
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 font-bold text-foreground">
          Score: {post.score}
        </span>
        <button
          type="button"
          onClick={() => onToggleComments(post.id)}
          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition ${
            isCommentsOpen
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:border-primary/40"
          }`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {post.comments_count}
        </button>
      </div>

      {isCommentsOpen ? (
        <div className="mt-3 rounded-2xl border border-border bg-background/60 p-3">
          {isCommentsLoading ? (
            <p className="text-xs text-muted-foreground">جاري تحميل التعليقات...</p>
          ) : threadedComments.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد تعليقات بعد — كن أول من يعلّق</p>
          ) : (
            <div className="space-y-2">
              {threadedComments.map(({ root, replies }) => (
                <div key={root.id} className="space-y-2 rounded-xl border border-border bg-card p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        {root.author_profile?.avatar_url ? (
                          <img src={root.author_profile.avatar_url} alt={root.author_profile?.full_name ?? "طالب"} className="h-6 w-6 rounded-full border border-border object-cover" />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-black text-foreground">
                            {(root.author_profile?.full_name?.trim() || "ط").charAt(0)}
                          </div>
                        )}
                        <p className="text-xs font-bold text-foreground">
                          {root.author_profile?.full_name?.trim() || "طالب"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {root.author_profile?.university?.trim() || "جامعة غير محددة"}
                        </p>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs leading-6 text-foreground/90">{root.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSetReplyTarget(post.id, root.id)}
                      className="rounded-lg border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:border-primary/40 hover:text-primary"
                    >
                      رد
                    </button>
                  </div>

                  {replies.length > 0 ? (
                    <div className="space-y-1 border-r border-border pr-2">
                      {replies.map((reply) => (
                        <div key={reply.id} className="rounded-lg border border-border/70 bg-background px-2 py-1.5">
                          <div className="mb-1 flex items-center gap-2">
                            {reply.author_profile?.avatar_url ? (
                              <img src={reply.author_profile.avatar_url} alt={reply.author_profile?.full_name ?? "طالب"} className="h-5 w-5 rounded-full border border-border object-cover" />
                            ) : (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted text-[9px] font-black text-foreground">
                                {(reply.author_profile?.full_name?.trim() || "ط").charAt(0)}
                              </div>
                            )}
                            <p className="text-[11px] font-bold text-foreground">{reply.author_profile?.full_name?.trim() || "طالب"}</p>
                            <p className="text-[10px] text-muted-foreground">{reply.author_profile?.university?.trim() || "جامعة غير محددة"}</p>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-xs leading-6 text-foreground/90">{reply.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {replyTargetCommentId ? (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-2 py-1">
              <p className="text-[11px] font-bold text-primary">الرد على تعليق</p>
              <button
                type="button"
                onClick={() => onSetReplyTarget(post.id, null)}
                className="text-[11px] text-primary/80"
              >
                إلغاء
              </button>
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-2">
            <input
              value={postCommentDraft}
              onChange={(event) => onDraftChange(post.id, event.target.value)}
              maxLength={260}
              placeholder={replyTargetCommentId ? "اكتب ردك..." : "اكتب تعليقك..."}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => onAddComment(post.id, postCommentDraft, replyTargetCommentId)}
              disabled={isAddCommentPending}
              className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary disabled:opacity-50"
            >
              إرسال
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
