import { useState } from "react";

export function useFeedInteractionState() {
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({});
  const [replyTargetByPostId, setReplyTargetByPostId] = useState<Record<string, string | null>>({});

  const toggleHashtag = (hashtag: string) => {
    setActiveHashtag((current) => (current === hashtag ? null : hashtag));
  };

  const clearActiveHashtag = () => {
    setActiveHashtag(null);
  };

  const toggleCommentsForPost = (postId: string) => {
    setExpandedCommentsPostId((current) => (current === postId ? null : postId));
  };

  const setReplyTargetForPost = (postId: string, commentId: string | null) => {
    setReplyTargetByPostId((current) => ({ ...current, [postId]: commentId }));
  };

  const setCommentDraftForPost = (postId: string, value: string) => {
    setCommentDraftByPostId((current) => ({ ...current, [postId]: value }));
  };

  const resetCommentComposerForPost = (postId: string) => {
    setCommentDraftByPostId((current) => ({ ...current, [postId]: "" }));
    setReplyTargetByPostId((current) => ({ ...current, [postId]: null }));
  };

  return {
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
  };
}