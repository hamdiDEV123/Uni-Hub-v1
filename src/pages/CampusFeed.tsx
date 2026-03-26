import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowDown, ArrowUp, BarChart3, Clock3, Flame, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fadeUpItem, pageVariants } from "@/lib/motion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  addCampusComment,
  type CampusPostCategory,
  type StoryReactionType,
  cleanupExpiredCampusStories,
  createCampusPostPoll,
  createCampusPost,
  deleteCampusPost,
  fetchCampusComments,
  fetchCampusLeaderboard,
  fetchCampusPosts,
  fetchCampusStories,
  fetchCampusTrendingHashtags,
  pinCampusPost,
  reactToCampusStory,
  voteCampusPoll,
  voteCampusPost,
} from "@/backend/campusFeedApi";
import {
  CAMPUS_CATEGORY_LABELS,
  PLATFORM_STORY_BACKGROUNDS,
  type StoryBackgroundId,
  type StoryFont,
} from "./campus-feed/campusFeed.constants";
import {
  clampPercent,
  formatTimeAgo,
  getStoryFontFamily,
  isStoryExpired,
} from "./campus-feed/campusFeed.utils";
import { StoryViewer } from "./campus-feed/components/StoryViewer";
import { FeedPostCard } from "./campus-feed/components/FeedPostCard";
import { StoryComposer } from "./campus-feed/components/StoryComposer";
import { FeedSidebar } from "./campus-feed/components/FeedSidebar";
import { useFeedInteractionState } from "./campus-feed/hooks/useFeedInteractionState";

export default function CampusFeed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState<CampusPostCategory>("general");
  const [feedSort, setFeedSort] = useState<"hot" | "new">("hot");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [storyCaption, setStoryCaption] = useState("");
  const [storyOverlayText, setStoryOverlayText] = useState("");
  const [storyImageFile, setStoryImageFile] = useState<File | null>(null);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);
  const [storyBackground, setStoryBackground] = useState<StoryBackgroundId>("uni_wave");
  const [storyFont, setStoryFont] = useState<StoryFont>("cairo");
  const [storyTextColor, setStoryTextColor] = useState("#ffffff");
  const [storyTextPosition, setStoryTextPosition] = useState({ x: 50, y: 50 });
  const [storyFontSize, setStoryFontSize] = useState(58);
  const [storyTextRotation, setStoryTextRotation] = useState(0);
  const [isDraggingStoryText, setIsDraggingStoryText] = useState(false);
  const [storyAnonymous, setStoryAnonymous] = useState(false);
  const [isStoryComposerOpen, setIsStoryComposerOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const {
    activeHashtag,
    expandedCommentsPostId,
    commentDraftByPostId,
    replyTargetByPostId,
    toggleHashtag,
    clearActiveHashtag,
    toggleCommentsForPost,
    setReplyTargetForPost,
    setCommentDraftForPost,
    resetCommentComposerForPost,
  } = useFeedInteractionState();
  const storyPreviewFrameRef = useRef<HTMLDivElement | null>(null);

  const feedQueryKey = ["campus-feed", user?.id ?? "", feedSort];
  const storiesQueryKey = ["campus-stories", user?.id ?? ""];
  const leaderboardQueryKey = ["campus-leaderboard"];

  const selectedStoryBackground =
    PLATFORM_STORY_BACKGROUNDS.find((preset) => preset.id === storyBackground) ?? PLATFORM_STORY_BACKGROUNDS[0];

  const updateStoryTextPositionFromPoint = (clientX: number, clientY: number) => {
    const container = storyPreviewFrameRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const nextX = ((clientX - rect.left) / rect.width) * 100;
    const nextY = ((clientY - rect.top) / rect.height) * 100;

    setStoryTextPosition({
      x: clampPercent(nextX),
      y: clampPercent(nextY),
    });
  };

  const applyStoryImageFile = (file: File) => {
    setStoryImageFile(file);
    setStoryPreviewUrl((currentUrl) => {
      if (currentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(currentUrl);
      }
      return URL.createObjectURL(file);
    });
  };

  const clearStoryImageSelection = () => {
    setStoryImageFile(null);
    setStoryPreviewUrl((currentUrl) => {
      if (currentUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(currentUrl);
      }
      return null;
    });
  };

  useEffect(() => {
    return () => {
      if (storyPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(storyPreviewUrl);
      }
    };
  }, [storyPreviewUrl]);

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("تعذر تحميل الصورة"));
      image.src = src;
    });

  const drawStoryBackground = async (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    backgroundId: StoryBackgroundId
  ) => {
    const selectedBackground =
      PLATFORM_STORY_BACKGROUNDS.find((preset) => preset.id === backgroundId) ?? PLATFORM_STORY_BACKGROUNDS[0];

    try {
      const image = await loadImage(selectedBackground.assetUrl);
      const imageRatio = image.width / image.height;
      const canvasRatio = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let offsetX = 0;
      let offsetY = 0;

      if (imageRatio > canvasRatio) {
        drawHeight = height;
        drawWidth = height * imageRatio;
        offsetX = (width - drawWidth) / 2;
      } else {
        drawWidth = width;
        drawHeight = width / imageRatio;
        offsetY = (height - drawHeight) / 2;
      }

      context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    } catch {
      const fallbackGradient = context.createLinearGradient(0, 0, width, height);
      fallbackGradient.addColorStop(0, "#1e3a8a");
      fallbackGradient.addColorStop(1, "#312e81");
      context.fillStyle = fallbackGradient;
      context.fillRect(0, 0, width, height);
    }
  };

  const renderWrappedText = (
    context: CanvasRenderingContext2D,
    text: string,
    canvasWidth: number,
    canvasHeight: number,
    position: { x: number; y: number },
    fontSize: number,
    rotationDeg: number
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const maxWidth = canvasWidth * 0.84;
    const lineHeight = Math.max(34, Math.round(fontSize * 1.25));
    const words = trimmed.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);

    const visibleLines = lines.slice(0, 6);
    const blockHeight = visibleLines.length * lineHeight;
    const centerX = canvasWidth * (position.x / 100);
    const centerY = canvasHeight * (position.y / 100);
    let currentY = -blockHeight / 2 + lineHeight / 2;

    context.save();
    context.translate(centerX, centerY);
    context.rotate((rotationDeg * Math.PI) / 180);
    context.textAlign = "center";
    context.shadowColor = "rgba(0,0,0,0.6)";
    context.shadowBlur = 16;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 2;

    visibleLines.forEach((line) => {
      context.fillText(line, 0, currentY);
      currentY += lineHeight;
    });
    context.restore();
  };

  const buildStoryImageBlob = async (): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("تعذر تجهيز محرر الصورة");
    }

    if (storyPreviewUrl) {
      const image = await loadImage(storyPreviewUrl);
      const imageRatio = image.width / image.height;
      const canvasRatio = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let offsetX = 0;
      let offsetY = 0;

      if (imageRatio > canvasRatio) {
        drawHeight = height;
        drawWidth = height * imageRatio;
        offsetX = (width - drawWidth) / 2;
      } else {
        drawWidth = width;
        drawHeight = width / imageRatio;
        offsetY = (height - drawHeight) / 2;
      }

      context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      context.fillStyle = "rgba(0,0,0,0.20)";
      context.fillRect(0, 0, width, height);
    } else {
      await drawStoryBackground(context, width, height, storyBackground);
    }

    context.fillStyle = storyTextColor;
    context.font = `700 ${storyFontSize}px ${getStoryFontFamily(storyFont)}`;
    renderWrappedText(context, storyOverlayText, width, height, storyTextPosition, storyFontSize, storyTextRotation);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("تعذر توليد صورة الستوري"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.92
      );
    });
  };

  const uploadStoryImageBlob = async (blob: Blob): Promise<string> => {
    if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");

    const uploadFile = new File([blob], `story-${crypto.randomUUID()}.jpg`, {
      type: "image/jpeg",
    });

    const candidatePaths = [
      `${user.id}/campus-stories/${uploadFile.name}`,
      `campus-stories/${uploadFile.name}`,
    ];

    let uploadedPath: string | null = null;
    let lastUploadError: unknown = null;

    for (const path of candidatePaths) {
      const { error: uploadError } = await supabase.storage
        .from("product_images")
        .upload(path, uploadFile, {
          upsert: false,
          contentType: "image/jpeg",
        });

      if (!uploadError) {
        uploadedPath = path;
        break;
      }
      lastUploadError = uploadError;
    }

    if (!uploadedPath) {
      throw lastUploadError ?? new Error("فشل رفع صورة الستوري");
    }

    const { data } = supabase.storage.from("product_images").getPublicUrl(uploadedPath);
    if (!data?.publicUrl) {
      throw new Error("تعذر استخراج رابط الصورة");
    }
    return data.publicUrl;
  };

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id ?? ""],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error) throw error;
      return Boolean(data);
    },
  });

  const { data: myGamification } = useQuery({
    queryKey: ["my-gamification", user?.id ?? ""],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_gamification")
        .select("current_streak,highest_streak,karma_points")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: stories = [] } = useQuery({
    queryKey: [...storiesQueryKey, isAdmin ? "admin" : "student"],
    enabled: !!user?.id,
    queryFn: async () => fetchCampusStories(user?.id, 20, isAdmin),
  });

  useQuery({
    queryKey: ["campus-stories-cleanup", user?.id ?? ""],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    queryFn: async () => cleanupExpiredCampusStories(500),
  });

  const { data: feed = [] } = useQuery({
    queryKey: feedQueryKey,
    enabled: !!user?.id,
    queryFn: async () => fetchCampusPosts({ limit: 30, sort: feedSort }, user?.id),
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: leaderboardQueryKey,
    enabled: !!user?.id,
    queryFn: async () => fetchCampusLeaderboard(5),
  });

  const { data: trendingHashtags = [] } = useQuery({
    queryKey: ["campus-trending-hashtags"],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => fetchCampusTrendingHashtags(8, 24),
  });

  const { data: activePostComments = [], isLoading: isCommentsLoading } = useQuery({
    queryKey: ["campus-comments", expandedCommentsPostId],
    enabled: Boolean(expandedCommentsPostId),
    queryFn: async () => {
      if (!expandedCommentsPostId) return [];
      return fetchCampusComments(expandedCommentsPostId);
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
      if (!postContent.trim() || postContent.trim().length < 2) {
        throw new Error("اكتب محتوى البوست أولاً");
      }

      const normalizedPollOptions = pollOptions
        .map((option) => option.trim())
        .filter((option, index, arr) => option.length > 0 && arr.indexOf(option) === index);

      if (isPollEnabled) {
        if (!pollQuestion.trim() || pollQuestion.trim().length < 4) {
          throw new Error("اكتب سؤال التصويت (4 أحرف على الأقل)");
        }

        if (normalizedPollOptions.length < 2 || normalizedPollOptions.length > 4) {
          throw new Error("التصويت لازم يحتوي من خيارين إلى 4 خيارات");
        }
      }

      const postId = await createCampusPost({
        authorId: user.id,
        postType: "thread",
        category: postCategory,
        content: postContent.trim(),
        isAnonymous: false,
      });

      if (isPollEnabled) {
        await createCampusPostPoll(
          postId,
          pollQuestion.trim(),
          normalizedPollOptions
        );
      }
    },
    onSuccess: async () => {
      setPostContent("");
      setIsAnonymous(false);
      setIsPollEnabled(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
        queryClient.invalidateQueries({ queryKey: leaderboardQueryKey }),
      ]);
      toast({ title: "تم نشر البوست", description: "بوستك نزل في الفيد بنجاح" });
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل نشر البوست",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const votePollMutation = useMutation({
    mutationFn: async ({ postId, optionId }: { postId: string; optionId: string }) =>
      voteCampusPoll(postId, optionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: feedQueryKey });
    },
    onError: (error: unknown) => {
      toast({
        title: "تعذر التصويت",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const reactStoryMutation = useMutation({
    mutationFn: async ({ storyPostId, reactionType }: { storyPostId: string; reactionType: StoryReactionType }) =>
      reactToCampusStory(storyPostId, reactionType),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campus-stories"] }),
        queryClient.invalidateQueries({ queryKey: leaderboardQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["my-gamification", user?.id ?? ""] }),
      ]);
    },
    onError: (error: unknown) => {
      toast({
        title: "تعذر إرسال التفاعل",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ postId, content, parentCommentId }: { postId: string; content: string; parentCommentId?: string | null }) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
      if (!content.trim() || content.trim().length < 2) {
        throw new Error("اكتب تعليقاً صالحاً");
      }
      return addCampusComment(postId, user.id, content.trim(), parentCommentId);
    },
    onSuccess: async (_, variables) => {
      resetCommentComposerForPost(variables.postId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["campus-comments", variables.postId] }),
      ]);
    },
    onError: (error: unknown) => {
      toast({
        title: "تعذر إضافة التعليق",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const toggleUpvoteMutation = useMutation({
    mutationFn: async ({ postId, vote }: { postId: string; vote: -1 | 1 }) => voteCampusPost(postId, vote),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
        queryClient.invalidateQueries({ queryKey: leaderboardQueryKey }),
      ]);
    },
    onError: (error: unknown) => {
      toast({
        title: "تعذر تنفيذ التفاعل",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const createStoryMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
      const hasCaption = storyCaption.trim().length > 0;
      const hasOverlayText = storyOverlayText.trim().length > 0;
      const hasImageSource = Boolean(storyPreviewUrl);

      if (!hasCaption && !hasOverlayText && !hasImageSource) {
        throw new Error("اختار صورة أو اكتب نص على الخلفية");
      }

      let uploadedMediaUrl: string | undefined;
      if (hasImageSource || hasOverlayText) {
        const storyBlob = await buildStoryImageBlob();
        uploadedMediaUrl = await uploadStoryImageBlob(storyBlob);
      }

      await createCampusPost({
        authorId: user.id,
        postType: "story",
        category: "general",
        content: hasCaption ? storyCaption.trim() : hasOverlayText ? storyOverlayText.trim() : undefined,
        mediaUrl: uploadedMediaUrl,
        isAnonymous: false,
      });
    },
    onSuccess: async () => {
      setStoryCaption("");
      setStoryOverlayText("");
      clearStoryImageSelection();
      setStoryBackground("uni_wave");
      setStoryFont("cairo");
      setStoryTextColor("#ffffff");
      setStoryTextPosition({ x: 50, y: 50 });
      setStoryFontSize(58);
      setStoryTextRotation(0);
      setStoryAnonymous(false);
      setIsStoryComposerOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storiesQueryKey }),
        queryClient.invalidateQueries({ queryKey: leaderboardQueryKey }),
      ]);
      toast({ title: "تم نشر اللقطة", description: "هتظهر لمدة 24 ساعة" });
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل نشر اللقطة",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ postId, pin }: { postId: string; pin: boolean }) => {
      if (!user?.id) throw new Error("يجب تسجيل الدخول");
      await pinCampusPost(postId, user.id, pin);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: feedQueryKey });
      toast({ title: "تم تحديث حالة التثبيت" });
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل تحديث التثبيت",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      await deleteCampusPost(postId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: feedQueryKey }),
        queryClient.invalidateQueries({ queryKey: storiesQueryKey }),
      ]);
      toast({ title: "تم حذف البوست" });
    },
    onError: (error: unknown) => {
      toast({
        title: "فشل حذف البوست",
        description: error instanceof Error ? error.message : "حاول مرة أخرى",
        variant: "destructive",
      });
    },
  });

  const topStories = useMemo(() => stories.slice(0, 12), [stories]);
  const filteredFeed = useMemo(() => {
    if (!activeHashtag) return feed;
    const needle = `#${activeHashtag.toLowerCase()}`;
    return feed.filter((post) => (post.content ?? "").toLowerCase().includes(needle));
  }, [feed, activeHashtag]);

  const threadedComments = useMemo(() => {
    const roots = activePostComments
      .filter((comment) => !comment.parent_comment_id)
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

    const repliesByParentId = new Map<string, typeof activePostComments>();
    for (const comment of activePostComments) {
      if (!comment.parent_comment_id) continue;
      const current = repliesByParentId.get(comment.parent_comment_id) ?? [];
      current.push(comment);
      repliesByParentId.set(comment.parent_comment_id, current);
    }

    return roots.map((root) => ({
      root,
      replies: (repliesByParentId.get(root.id) ?? []).sort(
        (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
      ),
    }));
  }, [activePostComments]);

  const activeStory = activeStoryIndex !== null ? topStories[activeStoryIndex] : null;
  const canDeleteActiveStory = Boolean(
    activeStory && user?.id && (activeStory.author_id === user.id || isAdmin)
  );

  const closeStoryViewer = useCallback(() => {
    setActiveStoryIndex(null);
    setStoryProgress(0);
    setIsStoryPaused(false);
  }, []);

  const openStoryViewer = (index: number) => {
    setActiveStoryIndex(index);
    setStoryProgress(0);
    setIsStoryPaused(false);
  };

  const goToNextStory = useCallback(() => {
    setActiveStoryIndex((current) => {
      if (current === null) return current;
      if (current >= topStories.length - 1) return null;
      return current + 1;
    });
    setStoryProgress(0);
    setIsStoryPaused(false);
  }, [topStories.length]);

  const goToPreviousStory = useCallback(() => {
    setActiveStoryIndex((current) => {
      if (current === null) return current;
      if (current <= 0) return current;
      return current - 1;
    });
    setStoryProgress(0);
    setIsStoryPaused(false);
  }, []);

  useEffect(() => {
    if (activeStoryIndex === null) return;

    if (activeStoryIndex >= topStories.length) {
      closeStoryViewer();
      return;
    }

    const timer = window.setInterval(() => {
      setStoryProgress((currentProgress) => {
        if (isStoryPaused) {
          return currentProgress;
        }

        const nextProgress = currentProgress + 2;
        if (nextProgress >= 100) {
          window.clearInterval(timer);
          goToNextStory();
          return 0;
        }
        return nextProgress;
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [activeStoryIndex, topStories.length, isStoryPaused, closeStoryViewer, goToNextStory]);

  useEffect(() => {
    if (activeStoryIndex === null) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeStoryIndex]);

  useEffect(() => {
    if (activeStoryIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeStoryViewer();
        return;
      }

      if (event.key === "ArrowRight") {
        goToPreviousStory();
        return;
      }

      if (event.key === "ArrowLeft") {
        goToNextStory();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeStoryIndex, closeStoryViewer, goToNextStory, goToPreviousStory]);

  const isActiveStoryExpired = Boolean(activeStory?.expires_at && isStoryExpired(activeStory.expires_at));
  const canReactToActiveStory = Boolean(
    activeStory && (!isActiveStoryExpired || activeStory.author_id === user?.id || isAdmin)
  );

  return (
    <motion.div
      dir="rtl"
      variants={pageVariants as Variants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <motion.div variants={fadeUpItem as Variants}>
        <div className="rounded-3xl border border-navy/20 bg-card p-6 shadow-hard">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            مجتمع الجامعة
          </span>
          <h1 className="mt-3 text-3xl font-black text-foreground">فيد الجامعة</h1>
          <p className="mt-1 text-sm text-muted-foreground">استريكات + بوستات + تفاعل الطلبة في مكان واحد</p>
        </div>
      </motion.div>

      <motion.div variants={fadeUpItem as Variants} className="rounded-3xl border border-border bg-card p-5 shadow-hard">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black md:text-lg">استريكات الجامعة</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-300/50 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-500">
            <Flame className="h-4 w-4" />
            {`استريكك: ${myGamification?.current_streak ?? 0}`}
          </span>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 md:gap-3">
          <div className="rounded-xl border border-orange-300/40 bg-orange-500/5 p-2.5 md:rounded-2xl md:p-3">
            <p className="text-[10px] text-muted-foreground md:text-[11px]">استريك اليوم</p>
            <p className="mt-1 text-base font-black text-orange-500 md:text-xl">{myGamification?.current_streak ?? 0} 🔥</p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5 md:rounded-2xl md:p-3">
            <p className="text-[10px] text-muted-foreground md:text-[11px]">أفضل استريك</p>
            <p className="mt-1 text-base font-black text-primary md:text-xl">{myGamification?.highest_streak ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 p-2.5 md:rounded-2xl md:p-3">
            <p className="text-[10px] text-muted-foreground md:text-[11px]">نقاط الكارما</p>
            <p className="mt-1 text-base font-black text-foreground md:text-xl">{myGamification?.karma_points ?? 0}</p>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {topStories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              لا توجد ستوريز حالياً — كن أول من ينشر قصة اليوم
            </div>
          ) : (
            topStories.map((story, index) => (
              <button
                key={story.id}
                type="button"
                onClick={() => openStoryViewer(index)}
                className="min-w-[108px] max-w-[108px] text-center"
              >
                <div
                  className={`mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 bg-primary/10 shadow-hard-sm ${
                    isStoryExpired(story.expires_at)
                      ? "border-amber-400/60"
                      : "border-primary/40"
                  }`}
                >
                  {story.media_url ? (
                    <img src={story.media_url} alt="story" className="h-full w-full object-cover" />
                  ) : (
                    <p className="line-clamp-3 px-2 text-[10px] font-bold leading-4 text-primary/90">
                      {story.content ?? "Story"}
                    </p>
                  )}
                </div>
                <p className="mt-1 line-clamp-1 text-[11px] font-bold text-foreground">
                  {story.author_profile?.full_name?.trim() || "طالب"}
                </p>
                <p className="line-clamp-1 text-[10px] text-muted-foreground">
                  {story.author_profile?.university?.trim() || "جامعة غير محددة"}
                </p>
                <p className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock3 className="h-3 w-3" />
                  {formatTimeAgo(story.created_at)}
                </p>
              </button>
            ))
          )}

          <StoryComposer
            isOpen={isStoryComposerOpen}
            storyPreviewUrl={storyPreviewUrl}
            storyOverlayText={storyOverlayText}
            storyTextColor={storyTextColor}
            storyTextPosition={storyTextPosition}
            storyFont={storyFont}
            storyFontSize={storyFontSize}
            storyTextRotation={storyTextRotation}
            storyBackground={storyBackground}
            storyCaption={storyCaption}
            storyAnonymous={storyAnonymous}
            isCreatePending={createStoryMutation.isPending}
            storyImageFile={storyImageFile}
            selectedStoryBackground={selectedStoryBackground}
            isDraggingStoryText={isDraggingStoryText}
            storyPreviewFrameRef={storyPreviewFrameRef}
            onToggle={() => setIsStoryComposerOpen((prev) => !prev)}
            onClose={() => setIsStoryComposerOpen(false)}
            onApplyImageFile={applyStoryImageFile}
            onClearImageSelection={clearStoryImageSelection}
            onStoryOverlayTextChange={setStoryOverlayText}
            onStoryBackgroundChange={setStoryBackground}
            onStoryFontChange={setStoryFont}
            onStoryTextColorChange={setStoryTextColor}
            onStoryTextPositionReset={() => setStoryTextPosition({ x: 50, y: 50 })}
            onStoryTextPositionPointerMove={updateStoryTextPositionFromPoint}
            onStoryTextDragStart={(clientX, clientY) => {
              setIsDraggingStoryText(true);
              updateStoryTextPositionFromPoint(clientX, clientY);
            }}
            onStoryTextDragEnd={() => setIsDraggingStoryText(false)}
            onStoryFontSizeChange={setStoryFontSize}
            onStoryTextRotationChange={setStoryTextRotation}
            onStoryCaptionChange={setStoryCaption}
            onStoryAnonymousChange={setStoryAnonymous}
            onCreateStory={() => createStoryMutation.mutate()}
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={fadeUpItem as Variants} className="space-y-4 lg:col-span-2">
          <div className="rounded-3xl border border-border bg-card p-4 md:p-5 shadow-hard">
            <h2 className="mb-2 text-base font-black md:mb-3 md:text-lg">اكتب بوست جديد</h2>
            <textarea
              value={postContent}
              onChange={(event) => setPostContent(event.target.value)}
              rows={3}
              placeholder="شارك دفعتك معلومة، سؤال، أو حتى ميم..."
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2.5 md:mt-3 md:gap-3">
              <select
                value={postCategory}
                onChange={(event) => setPostCategory(event.target.value as CampusPostCategory)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="general">عام</option>
                <option value="academic">أكاديمي</option>
                <option value="memes">ميمز</option>
                <option value="lost_found">فاقد وموجود</option>
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(event) => setIsAnonymous(event.target.checked)}
                  disabled
                />
                نشر بالهوية (مفعل)
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isPollEnabled}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIsPollEnabled(checked);
                    if (!checked) {
                      setPollQuestion("");
                      setPollOptions(["", ""]);
                    }
                  }}
                />
                إضافة تصويت
              </label>
              <Button
                className="mr-auto"
                onClick={() => createPostMutation.mutate()}
                disabled={createPostMutation.isPending}
              >
                {createPostMutation.isPending ? "جاري النشر..." : "نشر"}
              </Button>
            </div>

            {isPollEnabled ? (
              <div className="mt-3 space-y-2 rounded-2xl border border-border bg-background/70 p-3">
                <p className="inline-flex items-center gap-2 text-xs font-bold text-primary">
                  <BarChart3 className="h-4 w-4" />
                  تصويت داخل البوست
                </p>
                <input
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  maxLength={140}
                  placeholder="سؤال التصويت (مثال: مين أحسن دكتور في المادة؟)"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />

                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={`poll-option-${index}`} className="flex items-center gap-2">
                      <input
                        value={option}
                        onChange={(event) => {
                          const next = [...pollOptions];
                          next[index] = event.target.value;
                          setPollOptions(next);
                        }}
                        maxLength={80}
                        placeholder={`الخيار ${index + 1}`}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      {pollOptions.length > 2 ? (
                        <button
                          type="button"
                          onClick={() => setPollOptions((current) => current.filter((_, i) => i !== index))}
                          className="rounded-xl border border-red-500/40 px-2 py-2 text-xs font-bold text-red-600"
                        >
                          حذف
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                {pollOptions.length < 4 ? (
                  <button
                    type="button"
                    onClick={() => setPollOptions((current) => [...current, ""])}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary/40"
                  >
                    + إضافة خيار
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFeedSort("hot")}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  feedSort === "hot"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                🔥 Hot
              </button>
              <button
                type="button"
                onClick={() => setFeedSort("new")}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  feedSort === "new"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                🆕 New
              </button>
            </div>

            {activeHashtag ? (
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                <p className="text-xs font-bold text-primary">تصفية حسب: #{activeHashtag}</p>
                <button
                  type="button"
                  onClick={clearActiveHashtag}
                  className="rounded-full border border-primary/30 px-2 py-0.5 text-[11px] font-bold text-primary"
                >
                  إزالة
                </button>
              </div>
            ) : null}

            {filteredFeed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground shadow-hard-sm">
                {activeHashtag
                  ? "لا توجد بوستات بهذا الهاشتاج حالياً"
                  : "لا يوجد محتوى بعد. ابدأ أنت أول بوست 👌"}
              </div>
            ) : (
              filteredFeed.map((post) => {
                const isCommentsOpen = expandedCommentsPostId === post.id;
                const postCommentDraft = commentDraftByPostId[post.id] ?? "";
                const replyTargetCommentId = replyTargetByPostId[post.id] ?? null;

                return (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  isAdmin={isAdmin}
                  formatTimeAgo={formatTimeAgo}
                  isCommentsOpen={isCommentsOpen}
                  postCommentDraft={postCommentDraft}
                  replyTargetCommentId={replyTargetCommentId}
                  isCommentsLoading={isCommentsLoading}
                  threadedComments={threadedComments}
                  isVotePollPending={votePollMutation.isPending}
                  isAddCommentPending={addCommentMutation.isPending}
                  onTogglePin={(postId, pin) => togglePinMutation.mutate({ postId, pin })}
                  onDeletePost={(postId) => deletePostMutation.mutate(postId)}
                  onVotePoll={(postId, optionId) => votePollMutation.mutate({ postId, optionId })}
                  onVotePost={(postId, vote) => toggleUpvoteMutation.mutate({ postId, vote })}
                  onToggleComments={toggleCommentsForPost}
                  onSetReplyTarget={setReplyTargetForPost}
                  onDraftChange={setCommentDraftForPost}
                  onAddComment={(postId, content, parentCommentId) =>
                    addCommentMutation.mutate({
                      postId,
                      content,
                      parentCommentId,
                    })
                  }
                />
              )})
            )}
          </div>
        </motion.div>

        <motion.aside variants={fadeUpItem as Variants} className="space-y-4">
          <FeedSidebar
            leaderboard={leaderboard}
            trendingHashtags={trendingHashtags}
            activeHashtag={activeHashtag}
            onToggleHashtag={toggleHashtag}
          />
        </motion.aside>
      </div>

      <StoryViewer
        activeStory={activeStory}
        topStories={topStories}
        activeStoryIndex={activeStoryIndex}
        storyProgress={storyProgress}
        isActiveStoryExpired={isActiveStoryExpired}
        canDeleteActiveStory={canDeleteActiveStory}
        canReactToActiveStory={canReactToActiveStory}
        isReactPending={reactStoryMutation.isPending}
        formatTimeAgo={formatTimeAgo}
        onClose={closeStoryViewer}
        onDeleteActiveStory={() => {
          if (!activeStory) return;
          deletePostMutation.mutate(activeStory.id);
          closeStoryViewer();
        }}
        onPause={() => setIsStoryPaused(true)}
        onResume={() => setIsStoryPaused(false)}
        onNextStory={goToNextStory}
        onPreviousStory={goToPreviousStory}
        onReact={(reactionType) => {
          if (!activeStory) return;
          if (!canReactToActiveStory) {
            toast({
              title: "لا يمكن التفاعل",
              description: "الستوري منتهية — التفاعل متاح فقط أثناء نشاطها",
              variant: "destructive",
            });
            return;
          }
          reactStoryMutation.mutate({ storyPostId: activeStory.id, reactionType });
        }}
      />
    </motion.div>
  );
}
