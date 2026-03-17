# Release Handoff Checklist — Campus Feed Modular Split

Date: March 17, 2026

## Completed Implementation

- [x] Story composer extracted and wired (`StoryComposer`).
- [x] Feed sidebar extracted and wired (`FeedSidebar`).
- [x] Post card rendering extracted (`FeedPostCard`).
- [x] Story viewer extracted (`StoryViewer`).
- [x] Interaction UI state extracted (`useFeedInteractionState`).
- [x] Admin campus console UX hardened.
- [x] Targeted Campus Feed tests added.

## Validation

- [x] TypeScript check passes.
- [x] Vitest suite passes.

## No DB Migration Required

- [x] This refactor is frontend-only for Campus Feed and admin UX.

## Smoke-Check Before Release

1. Open `/campus-feed` and verify:
   - Story compose open/close and publish flow.
   - Story viewer navigation and reaction actions.
   - Feed post voting and comment/reply actions.
   - Trending hashtag toggling behavior.
2. Open `/admin/campus-feed` and verify:
   - Posts/stories loading and search/filter behavior.
   - Pin/unpin and delete with confirmation.
   - Comments review panel, verify/unverify and delete actions.
   - Error retry and manual refresh actions.

## Rollback Plan

- Revert commits touching:
  - `src/pages/CampusFeed.tsx`
  - `src/pages/admin/AdminCampusFeedConsole.tsx`
  - `src/pages/campus-feed/**`
  - `src/test/campusFeed.test.ts`
