import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CampusPostType = "thread" | "story";
export type CampusPostCategory = "general" | "academic" | "memes" | "lost_found";

export type CampusPostRow = Database["public"]["Tables"]["campus_posts"]["Row"];
type CampusPostInsert = Database["public"]["Tables"]["campus_posts"]["Insert"];
type CampusPostUpdate = Database["public"]["Tables"]["campus_posts"]["Update"];

export type CampusCommentRow = Database["public"]["Tables"]["campus_post_comments"]["Row"];
type CampusCommentInsert = Database["public"]["Tables"]["campus_post_comments"]["Insert"];
type CampusCommentUpdate = Database["public"]["Tables"]["campus_post_comments"]["Update"];
type CampusStoryReactionRow = Database["public"]["Tables"]["campus_story_reactions"]["Row"];

export type CampusPollRow = Database["public"]["Tables"]["campus_post_polls"]["Row"];
type CampusPollOptionRow = Database["public"]["Tables"]["campus_post_poll_options"]["Row"];

export type UserGamificationRow = Database["public"]["Tables"]["user_gamification"]["Row"];

export interface CampusFeedFilters {
  postType?: CampusPostType | "all";
  category?: CampusPostCategory | "all";
  sort?: "hot" | "new";
  faculty?: string;
  studyYear?: string;
  term?: string;
  limit?: number;
  includeExpiredStories?: boolean;
}

export interface CreateCampusPostInput {
  authorId: string;
  postType: CampusPostType;
  category?: CampusPostCategory;
  content?: string;
  mediaUrl?: string;
  isAnonymous?: boolean;
  faculty?: string;
  studyYear?: string;
  term?: string;
  expiresAt?: string;
}

export interface UpdateCampusPostInput {
  postId: string;
  content?: string;
  mediaUrl?: string;
  category?: CampusPostCategory;
  isAnonymous?: boolean;
}

export interface CampusPostWithMeta extends CampusPostRow {
  user_vote: -1 | 0 | 1;
  user_has_upvoted: boolean;
  score: number;
  poll: CampusPostPoll | null;
  story_reactions: CampusStoryReactions | null;
  author_profile: CampusAuthorProfile | null;
}

export interface CampusCommentWithMeta extends CampusCommentRow {
  author_profile: CampusAuthorProfile | null;
}

export interface CampusAuthorProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  university: string | null;
}

export type StoryReactionType = "like" | "fire" | "laugh" | "clap" | "wow";

export interface CampusStoryReactions {
  user_reaction_type: StoryReactionType | null;
  total_reactions: number;
  counts: Record<StoryReactionType, number>;
}

export interface CampusPostPollOption {
  id: string;
  option_text: string;
  sort_order: number;
  votes_count: number;
}

export interface CampusPostPoll {
  id: string;
  question: string;
  allow_multiple: boolean;
  total_votes: number;
  user_option_id: string | null;
  options: CampusPostPollOption[];
}

export interface CampusLeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  current_streak: number;
  highest_streak: number;
  karma_points: number;
  updated_at: string;
}

export interface CampusTrendingHashtag {
  hashtag: string;
  posts_count: number;
  trend_score: number;
}

function clampLimit(limit: number | undefined, fallback = 50): number {
  if (!limit || Number.isNaN(limit)) return fallback;
  return Math.min(Math.max(1, limit), 200);
}

function nowIsoUtc(): string {
  return new Date().toISOString();
}

const STORY_REACTION_TYPES: StoryReactionType[] = ["like", "fire", "laugh", "clap", "wow"];

function computeCampusHotRank(row: Pick<CampusPostRow, "upvotes_count" | "downvotes_count" | "created_at">): number {
  const upvotes = Number(row.upvotes_count ?? 0);
  const downvotes = Number(row.downvotes_count ?? 0);
  const baseScore = upvotes - downvotes;

  const totalVotes = Math.max(0, upvotes + downvotes);
  const engagementBoost = Math.log10(totalVotes + 1);

  const createdAt = new Date(row.created_at).getTime();
  const ageHours = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60));
  const recencyBoost = 3 * Math.exp(-ageHours / 72);

  return baseScore + engagementBoost + recencyBoost;
}

export async function fetchCampusPosts(
  filters: CampusFeedFilters = {},
  userId?: string
): Promise<CampusPostWithMeta[]> {
  let query = supabase.from("campus_posts").select("*");

  const currentIso = nowIsoUtc();
  const includeExpiredStories = Boolean(filters.includeExpiredStories);

  if (filters.postType && filters.postType !== "all") {
    query = query.eq("post_type", filters.postType);

    if (filters.postType === "story" && !includeExpiredStories) {
      query = query.gt("expires_at", currentIso);
    }
  } else {
    query = query.or(`post_type.neq.story,expires_at.gt.${currentIso}`);
  }

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  if (filters.faculty?.trim()) {
    query = query.eq("scope_faculty", filters.faculty.trim());
  }

  if (filters.studyYear?.trim()) {
    query = query.eq("scope_study_year", filters.studyYear.trim());
  }

  if (filters.term?.trim()) {
    query = query.eq("scope_term", filters.term.trim());
  }

  const { data, error } = await query
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(clampLimit(filters.limit, 60));

  if (error) throw error;

  const posts = (data ?? []) as CampusPostRow[];
  const authorIds = Array.from(new Set(posts.map((post) => post.author_id).filter(Boolean)));
  let authorProfileById = new Map<string, CampusAuthorProfile>();

  if (authorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,full_name,avatar_url,university")
      .in("id", authorIds);

    if (profilesError) throw profilesError;

    authorProfileById = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          university: profile.university,
        },
      ])
    );
  }

  if (!userId || posts.length === 0) {
    const base = posts.map((post) => ({
      ...post,
      user_vote: 0 as const,
      user_has_upvoted: false,
      score: Number(post.upvotes_count ?? 0) - Number(post.downvotes_count ?? 0),
      poll: null,
      story_reactions: null,
      author_profile: authorProfileById.get(post.author_id) ?? null,
    }));

    if (filters.sort === "hot") {
      return base.sort((left, right) => {
        const rightRank = computeCampusHotRank(right);
        const leftRank = computeCampusHotRank(left);
        if (rightRank !== leftRank) return rightRank - leftRank;
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
    }

    return base;
  }

  const postIds = posts.map((post) => post.id);
  const { data: votes, error: votesError } = await supabase
    .from("campus_post_interactions")
    .select("post_id,interaction_type")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (votesError) throw votesError;

  const voteByPostId = new Map<string, -1 | 0 | 1>();
  for (const voteRow of votes ?? []) {
    voteByPostId.set(voteRow.post_id, voteRow.interaction_type === "upvote" ? 1 : -1);
  }

  const enriched = posts.map((post) => {
    const userVote = voteByPostId.get(post.id) ?? 0;
    return {
      ...post,
      user_vote: userVote,
      user_has_upvoted: userVote === 1,
      score: Number(post.upvotes_count ?? 0) - Number(post.downvotes_count ?? 0),
      poll: null,
      story_reactions: null,
      author_profile: authorProfileById.get(post.author_id) ?? null,
    };
  });

  const { data: pollRows, error: pollRowsError } = await supabase
    .from("campus_post_polls")
    .select("id,post_id,question,allow_multiple")
    .in("post_id", postIds);

  if (pollRowsError) throw pollRowsError;

  const polls = (pollRows ?? []) as Pick<CampusPollRow, "id" | "post_id" | "question" | "allow_multiple">[];
  if (polls.length > 0) {
    const pollIds = polls.map((poll) => poll.id);

    const { data: optionRows, error: optionRowsError } = await supabase
      .from("campus_post_poll_options")
      .select("id,poll_id,option_text,sort_order,votes_count")
      .in("poll_id", pollIds)
      .order("sort_order", { ascending: true });

    if (optionRowsError) throw optionRowsError;

    const options = (optionRows ?? []) as Array<
      Pick<CampusPollOptionRow, "id" | "poll_id" | "option_text" | "sort_order" | "votes_count">
    >;
    const optionsByPollId = new Map<string, CampusPostPollOption[]>();

    for (const option of options) {
      const current = optionsByPollId.get(option.poll_id) ?? [];
      current.push({
        id: option.id,
        option_text: option.option_text,
        sort_order: Number(option.sort_order ?? 0),
        votes_count: Number(option.votes_count ?? 0),
      });
      optionsByPollId.set(option.poll_id, current);
    }

    const userVoteByPollId = new Map<string, string>();
    if (userId && pollIds.length > 0) {
      const { data: userPollVotes, error: userPollVotesError } = await supabase
        .from("campus_post_poll_votes")
        .select("poll_id,option_id")
        .eq("user_id", userId)
        .in("poll_id", pollIds);

      if (userPollVotesError) throw userPollVotesError;

      for (const vote of userPollVotes ?? []) {
        userVoteByPollId.set(vote.poll_id, vote.option_id);
      }
    }

    const pollByPostId = new Map<string, CampusPostPoll>();
    for (const poll of polls) {
      const pollOptions = optionsByPollId.get(poll.id) ?? [];
      const totalVotes = pollOptions.reduce((sum, option) => sum + Number(option.votes_count ?? 0), 0);

      pollByPostId.set(poll.post_id, {
        id: poll.id,
        question: poll.question,
        allow_multiple: Boolean(poll.allow_multiple),
        total_votes: totalVotes,
        user_option_id: userVoteByPollId.get(poll.id) ?? null,
        options: pollOptions,
      });
    }

    for (const post of enriched) {
      post.poll = pollByPostId.get(post.id) ?? null;
    }
  }

  const storyIds = enriched.filter((post) => post.post_type === "story").map((post) => post.id);
  if (storyIds.length > 0) {
    const { data: reactionRows, error: reactionRowsError } = await supabase
      .from("campus_story_reactions")
      .select("story_post_id,user_id,reaction_type")
      .in("story_post_id", storyIds);

    if (reactionRowsError) throw reactionRowsError;

    const rows = (reactionRows ?? []) as Array<Pick<CampusStoryReactionRow, "story_post_id" | "user_id" | "reaction_type">>;
    const metaByStoryId = new Map<string, CampusStoryReactions>();

    for (const storyId of storyIds) {
      metaByStoryId.set(storyId, {
        user_reaction_type: null,
        total_reactions: 0,
        counts: { like: 0, fire: 0, laugh: 0, clap: 0, wow: 0 },
      });
    }

    for (const row of rows) {
      const type = row.reaction_type as StoryReactionType;
      if (!STORY_REACTION_TYPES.includes(type)) continue;

      const current = metaByStoryId.get(row.story_post_id);
      if (!current) continue;

      current.counts[type] = Number(current.counts[type] ?? 0) + 1;
      current.total_reactions += 1;

      if (row.user_id === userId) {
        current.user_reaction_type = type;
      }
    }

    for (const post of enriched) {
      if (post.post_type !== "story") continue;
      post.story_reactions = metaByStoryId.get(post.id) ?? {
        user_reaction_type: null,
        total_reactions: 0,
        counts: { like: 0, fire: 0, laugh: 0, clap: 0, wow: 0 },
      };
    }
  }

  if (filters.sort === "hot") {
    return enriched.sort((left, right) => {
      const rightRank = computeCampusHotRank(right);
      const leftRank = computeCampusHotRank(left);
      if (rightRank !== leftRank) return rightRank - leftRank;
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }

  return enriched;
}

export async function fetchCampusStories(
  userId?: string,
  limit = 30,
  includeExpiredStories = true
): Promise<CampusPostWithMeta[]> {
  return fetchCampusPosts({ postType: "story", limit, includeExpiredStories }, userId);
}

export async function cleanupExpiredCampusStories(limit = 1000): Promise<number> {
  const { data, error } = await supabase.rpc("cleanup_expired_campus_stories", {
    _limit: Math.min(Math.max(limit, 1), 10000),
  });

  if (error) throw error;
  return Number(data ?? 0);
}

export async function createCampusPost(input: CreateCampusPostInput): Promise<string> {
  const payload: CampusPostInsert = {
    author_id: input.authorId,
    post_type: input.postType,
    category: input.category ?? "general",
    content: input.content?.trim() || null,
    media_url: input.mediaUrl?.trim() || null,
    is_anonymous: false,
    scope_faculty: input.faculty?.trim() || null,
    scope_study_year: input.studyYear?.trim() || null,
    scope_term: input.term?.trim() || null,
    expires_at:
      input.postType === "story"
        ? input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null,
  };

  const { data, error } = await supabase.from("campus_posts").insert(payload).select("id").single();

  if (error) throw error;
  if (!data?.id) throw new Error("تعذر إنشاء البوست");

  return data.id;
}

export async function updateCampusPost(input: UpdateCampusPostInput): Promise<void> {
  const updates: CampusPostUpdate = {};

  if (typeof input.content === "string") {
    updates.content = input.content.trim() || null;
  }

  if (typeof input.mediaUrl === "string") {
    updates.media_url = input.mediaUrl.trim() || null;
  }

  if (typeof input.category === "string") {
    updates.category = input.category;
  }

  updates.is_anonymous = false;

  const { error } = await supabase.from("campus_posts").update(updates).eq("id", input.postId);
  if (error) throw error;
}

export async function deleteCampusPost(postId: string): Promise<void> {
  const { error } = await supabase.from("campus_posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function pinCampusPost(postId: string, adminUserId: string, isPinned: boolean): Promise<void> {
  const updates: CampusPostUpdate = {
    is_pinned: isPinned,
    pinned_by: isPinned ? adminUserId : null,
    pinned_at: isPinned ? new Date().toISOString() : null,
  };

  const { error } = await supabase.from("campus_posts").update(updates).eq("id", postId);
  if (error) throw error;
}

export async function toggleCampusPostUpvote(
  postId: string
): Promise<{ upvotesCount: number; userHasUpvoted: boolean }> {
  const { data, error } = await supabase.rpc("toggle_campus_post_upvote", {
    _post_id: postId,
  });

  if (error) throw error;

  const first = Array.isArray(data) ? data[0] : null;
  return {
    upvotesCount: Number(first?.upvotes_count ?? 0),
    userHasUpvoted: Boolean(first?.user_has_upvoted),
  };
}

export async function voteCampusPost(
  postId: string,
  vote: -1 | 1
): Promise<{ upvotesCount: number; downvotesCount: number; userVote: -1 | 0 | 1 }> {
  const { data, error } = await supabase.rpc("vote_campus_post", {
    _post_id: postId,
    _vote: vote,
  });

  if (error) throw error;

  const first = Array.isArray(data) ? data[0] : null;
  const userVoteRaw = Number(first?.user_vote ?? 0);
  const userVote: -1 | 0 | 1 = userVoteRaw === 1 ? 1 : userVoteRaw === -1 ? -1 : 0;

  return {
    upvotesCount: Number(first?.upvotes_count ?? 0),
    downvotesCount: Number(first?.downvotes_count ?? 0),
    userVote,
  };
}

export async function fetchCampusComments(postId: string): Promise<CampusCommentWithMeta[]> {
  const { data, error } = await supabase
    .from("campus_post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const comments = (data ?? []) as CampusCommentRow[];
  const authorIds = Array.from(new Set(comments.map((comment) => comment.author_id).filter(Boolean)));

  let authorProfileById = new Map<string, CampusAuthorProfile>();
  if (authorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,full_name,avatar_url,university")
      .in("id", authorIds);

    if (profilesError) throw profilesError;

    authorProfileById = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          university: profile.university,
        },
      ])
    );
  }

  return comments.map((comment) => ({
    ...comment,
    author_profile: authorProfileById.get(comment.author_id) ?? null,
  }));
}

export async function addCampusComment(
  postId: string,
  authorId: string,
  content: string,
  parentCommentId?: string | null
): Promise<string> {
  const payload: CampusCommentInsert = {
    post_id: postId,
    author_id: authorId,
    content: content.trim(),
    parent_comment_id: parentCommentId ?? null,
  };

  const { data, error } = await supabase
    .from("campus_post_comments")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("تعذر إضافة التعليق");

  return data.id;
}

export async function updateCampusComment(commentId: string, content: string): Promise<void> {
  const updates: CampusCommentUpdate = {
    content: content.trim(),
  };

  const { error } = await supabase
    .from("campus_post_comments")
    .update(updates)
    .eq("id", commentId);

  if (error) throw error;
}

export async function deleteCampusComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("campus_post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

export async function markCampusCommentVerified(
  commentId: string,
  adminUserId: string,
  isVerified: boolean
): Promise<void> {
  const updates: CampusCommentUpdate = {
    is_verified_answer: isVerified,
    verified_by: isVerified ? adminUserId : null,
    verified_at: isVerified ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from("campus_post_comments")
    .update(updates)
    .eq("id", commentId);

  if (error) throw error;
}

export async function fetchCampusLeaderboard(limit = 5): Promise<CampusLeaderboardEntry[]> {
  const safeLimit = clampLimit(limit, 5);

  const { data: gamificationRows, error: gamificationError } = await supabase
    .from("user_gamification")
    .select("user_id,current_streak,highest_streak,karma_points,updated_at")
    .order("updated_at", { ascending: false })
    .order("current_streak", { ascending: false })
    .order("karma_points", { ascending: false })
    .limit(safeLimit);

  if (gamificationError) throw gamificationError;

  const rows = gamificationRows ?? [];
  if (rows.length === 0) return [];

  const userIds = rows.map((row) => row.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,full_name,avatar_url")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return rows.map((row) => {
    const profile = profileById.get(row.user_id);
    return {
      user_id: row.user_id,
      full_name: profile?.full_name ?? "طالب",
      avatar_url: profile?.avatar_url ?? null,
      current_streak: row.current_streak,
      highest_streak: row.highest_streak,
      karma_points: row.karma_points,
      updated_at: row.updated_at,
    };
  });
}

export async function fetchCampusTrendingHashtags(limit = 8, hours = 24): Promise<CampusTrendingHashtag[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 30);
  const safeHours = Math.min(Math.max(hours, 1), 168);

  const { data, error } = await supabase.rpc("fetch_campus_trending_hashtags", {
    _limit: safeLimit,
    _hours: safeHours,
  });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    hashtag: String(row.hashtag ?? ""),
    posts_count: Number(row.posts_count ?? 0),
    trend_score: Number(row.trend_score ?? 0),
  }));
}

export async function createCampusPostPoll(
  postId: string,
  question: string,
  options: string[]
): Promise<string> {
  const { data, error } = await supabase.rpc("create_campus_post_poll", {
    _post_id: postId,
    _question: question,
    _options: options,
  });

  if (error) throw error;
  if (!data) throw new Error("تعذر إنشاء التصويت");
  return String(data);
}

export async function voteCampusPoll(
  postId: string,
  optionId: string
): Promise<Array<{ option_id: string; votes_count: number; total_votes: number; user_option_id: string | null }>> {
  const { data, error } = await supabase.rpc("vote_campus_poll", {
    _post_id: postId,
    _option_id: optionId,
  });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    option_id: String(row.option_id),
    votes_count: Number(row.votes_count ?? 0),
    total_votes: Number(row.total_votes ?? 0),
    user_option_id: row.user_option_id ? String(row.user_option_id) : null,
  }));
}

export async function reactToCampusStory(
  storyPostId: string,
  reactionType: StoryReactionType
): Promise<{ user_reaction_type: StoryReactionType | null; total_reactions: number }> {
  const { data, error } = await supabase.rpc("react_to_campus_story", {
    _story_post_id: storyPostId,
    _reaction_type: reactionType,
  });

  if (error) throw error;

  const first = Array.isArray(data) ? data[0] : null;
  const userReactionRaw = first?.user_reaction_type;
  const userReaction = STORY_REACTION_TYPES.includes(userReactionRaw as StoryReactionType)
    ? (userReactionRaw as StoryReactionType)
    : null;

  return {
    user_reaction_type: userReaction,
    total_reactions: Number(first?.total_reactions ?? 0),
  };
}
