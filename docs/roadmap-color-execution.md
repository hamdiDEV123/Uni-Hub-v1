# UniHub Rebuild Roadmap (Color Phases)

## Legend

- `RED` = Stabilize and freeze risky changes
- `BLUE` = Backend contracts and typed RPC layer
- `CYAN` = Marketplace buyer experience
- `ORANGE` = Admin marketplace console
- `PURPLE` = Notifications/event matrix
- `GREEN` = Delivery/Housing/Sports rebuild
- `YELLOW` = UX/brand polish + Arabic fixes
- `GRAY` = Security/performance hardening
- `GOLD` = Release and monitoring

## Phase Board

1. `RED` Stabilization
- Status: `IN_PROGRESS`
- Target:
  - Keep legacy flows available while V2 is introduced.
  - Ensure every iteration is build-safe.
- Done:
  - Marketplace legacy route kept at `/marketplace/legacy`.
  - Production build currently passing.

2. `BLUE` Backend Contracts
- Status: `IN_PROGRESS`
- Target:
  - Remove `any` from the new backend surface.
  - Keep frontend logic money/status-light and RPC-first.
- Done:
  - Added typed RPC wrapper in `src/backend/rpc.ts`.
  - Expanded Supabase types for marketplace/notifications usage.
  - Removed `any` from new marketplace V2 pages and backend layer.

3. `CYAN` Marketplace V2 Buyer Flow
- Status: `IN_PROGRESS`
- Target:
  - Product listing, product landing, checkout, manual payment flow.
- Done:
  - `MarketplaceV2`, `ProductLanding`, `MarketplaceCheckoutV2` wired.
  - Manual receipt submit flow integrated.
  - Cart-first checkout with address selection wired to `create_market_checkout_from_cart`.
- Remaining:
  - Better post-checkout order confirmation page with direct order links.

4. `ORANGE` Admin Marketplace
- Status: `IN_PROGRESS`
- Target:
  - Unified admin page for product moderation, manual receipt review, disputes, payouts, upgrades.
- Done:
  - Added `AdminMarketplaceConsoleV2` and routed `/admin` to it.
  - Legacy admin is still available at `/admin/legacy`.
  - Added route alias `/admin/marketplace` for old/new deep links compatibility.
  - Added section-based navigation (`?section=products|receipts|upgrades|payouts|disputes`) and global search filter.
  - Added status chips per admin section (products, receipts, upgrades, payouts, disputes).
  - Summary stat cards are now clickable to jump to their section.

5. `PURPLE` Notifications Matrix
- Status: `IN_PROGRESS`
- Target:
  - Important events route users to exact pages.
- Done:
  - Notifications page now reads deep links and marks as read on open.
  - If an admin notification uses `/admin/marketplace`, frontend now maps it to the most likely section automatically.
  - Added DB migration to normalize admin notification links to section-based routes via `market_admin_route(...)`.
- Remaining:
  - Verify all event producers emit `link` consistently after migration rollout.

6. `GREEN` Delivery/Housing/Sports V2
- Status: `IN_PROGRESS`
- Done:
  - Housing roommate matcher schema/types/migration sync completed.
  - Campus Feed modular split started and stabilized:
    - Extracted `StoryViewer`, `StoryComposer`, `FeedPostCard`, `FeedSidebar`.
    - Added `useFeedInteractionState` for comment/hashtag UI state.
    - Added targeted Campus Feed tests in `src/test/campusFeed.test.ts`.
  - Admin Campus Feed Console UX hardened (retry states, confirmations, per-item pending states).
- Docs:
  - `docs/campus-feed-modularization.md`
  - `docs/release-handoff-campus-feed.md`

7. `YELLOW` UX/Arabic Polish
- Status: `PENDING`

8. `GRAY` Hardening
- Status: `PENDING`

9. `GOLD` Release
- Status: `PENDING`
