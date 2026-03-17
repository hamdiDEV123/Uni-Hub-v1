# Campus Feed Modularization (March 17, 2026)

## Scope

This update reduces `src/pages/CampusFeed.tsx` complexity by extracting story/feed/sidebar UI and interaction state into dedicated modules.

## New Modules

- `src/pages/campus-feed/campusFeed.constants.ts`
  - Story backgrounds, font labels, category labels, story reactions.
- `src/pages/campus-feed/campusFeed.utils.ts`
  - `getStoryFontFamily`, `clampPercent`, `formatTimeAgo`, `isStoryExpired`.
- `src/pages/campus-feed/components/StoryViewer.tsx`
  - Full-screen story playback UI, reactions, navigation.
- `src/pages/campus-feed/components/FeedPostCard.tsx`
  - Feed post card rendering, voting, polling, comments actions.
- `src/pages/campus-feed/components/StoryComposer.tsx`
  - Story compose UI (image/background/font/text controls and publish action).
- `src/pages/campus-feed/components/FeedSidebar.tsx`
  - Leaderboard and trending hashtags side panel.
- `src/pages/campus-feed/hooks/useFeedInteractionState.ts`
  - UI interaction state for hashtag filter and comment composer.

## Admin UX Hardening

`src/pages/admin/AdminCampusFeedConsole.tsx` now includes:

- Retry UI for query errors (stories/posts/comments).
- Filter reset and manual refresh actions.
- Destructive action confirmation for post/comment deletion.
- Per-item pending states (instead of locking all action buttons).
- Better progress labels for pin/delete/verify actions.

## Tests Added

- `src/test/campusFeed.test.ts`
  - Unit tests for `campusFeed.utils`.
  - Hook tests for `useFeedInteractionState`.

## Validation Snapshot

- `npm.cmd run typecheck` ✅
- `npm.cmd run test -- --run` ✅
