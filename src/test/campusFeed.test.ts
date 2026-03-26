import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  clampPercent,
  formatTimeAgo,
  getStoryFontFamily,
  isStoryExpired,
} from "@/pages/campus-feed/campusFeed.utils";
import { useFeedInteractionState } from "@/pages/campus-feed/hooks/useFeedInteractionState";

describe("campusFeed.utils", () => {
  it("getStoryFontFamily should resolve known fonts", () => {
    expect(getStoryFontFamily("cairo")).toContain("Cairo");
    expect(getStoryFontFamily("tajawal")).toContain("Tajawal");
    expect(getStoryFontFamily("system")).toContain("system-ui");
  });

  it("clampPercent should keep value between 8 and 92", () => {
    expect(clampPercent(-10)).toBe(8);
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(200)).toBe(92);
  });

  it("isStoryExpired should reflect expiry date correctly", () => {
    const pastIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const futureIso = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    expect(isStoryExpired(null)).toBe(false);
    expect(isStoryExpired(pastIso)).toBe(true);
    expect(isStoryExpired(futureIso)).toBe(false);
  });

  it("formatTimeAgo should return compact arabic units", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    expect(formatTimeAgo(fiveMinutesAgo)).toContain("د");
    expect(formatTimeAgo(twoHoursAgo)).toContain("س");
  });
});

describe("useFeedInteractionState", () => {
  it("should toggle hashtag and clear it", () => {
    const { result } = renderHook(() => useFeedInteractionState());

    act(() => {
      result.current.toggleHashtag("unihub");
    });
    expect(result.current.activeHashtag).toBe("unihub");

    act(() => {
      result.current.toggleHashtag("unihub");
    });
    expect(result.current.activeHashtag).toBeNull();

    act(() => {
      result.current.toggleHashtag("delta");
      result.current.clearActiveHashtag();
    });
    expect(result.current.activeHashtag).toBeNull();
  });

  it("should manage post comments draft and reply state", () => {
    const { result } = renderHook(() => useFeedInteractionState());
    const postId = "post-1";

    act(() => {
      result.current.toggleCommentsForPost(postId);
      result.current.setCommentDraftForPost(postId, "hello");
      result.current.setReplyTargetForPost(postId, "comment-1");
    });

    expect(result.current.expandedCommentsPostId).toBe(postId);
    expect(result.current.commentDraftByPostId[postId]).toBe("hello");
    expect(result.current.replyTargetByPostId[postId]).toBe("comment-1");

    act(() => {
      result.current.resetCommentComposerForPost(postId);
      result.current.toggleCommentsForPost(postId);
    });

    expect(result.current.expandedCommentsPostId).toBeNull();
    expect(result.current.commentDraftByPostId[postId]).toBe("");
    expect(result.current.replyTargetByPostId[postId]).toBeNull();
  });
});
