# Backend Business Rules (Supabase Driven)

This document is the clean source of truth for rebuilding the frontend on top of the current Supabase backend.

## Core Domains

1. Marketplace
2. Delivery
3. Housing
4. Sports
5. Notifications
6. Admin moderation and finance controls

## Marketplace Rules

### Product lifecycle

- `products.moderation_status`: `pending -> approved|rejected`
- `products.listing_status`: `pending_review|active|paused|sold|archived`
- Admin actions are handled by `admin_manage_market_product`:
  - `approve`
  - `reject` (requires reason)
  - `archive`
  - `restore_activate`
  - `delete_now`
  - `bulk_cleanup`

### Checkout and order creation

- `create_market_checkout_order(_product_id, _payment_method)`
- `create_market_checkout_from_cart(_address_id, _payment_method)`
- Fees are computed server-side:
  - `get_market_service_fee`
  - `get_market_payment_method_fee`
  - `get_market_checkout_breakdown`
  - `get_market_commission_rate`

### Payment flow

- `market_orders.payment_status`: `pending|captured|failed|refunded`
- Manual methods supported: `vodafone_cash`, `instapay`
- Manual receipt submission:
  - `submit_market_manual_payment_receipt`
  - Admin review via `review_market_manual_payment_receipt`

### Order status flow

- State machine is enforced by `transition_market_order_status`.
- Seller transitions:
  - `paid_held -> processing`
  - `processing -> shipped`
- Buyer transitions:
  - `shipped -> delivered`
  - `pending_payment|paid_held -> cancelled`
- Admin can force transitions as needed.

### Seller finance and tiering

- Payout request: `request_market_payout`
- Tier upgrade request: `request_market_seller_tier_upgrade`
- Admin review: `review_market_seller_upgrade_request`

## Delivery Rules

- Event notifications are emitted by triggers:
  - `notify_delivery_offer_event`
  - `notify_delivery_order_event`
  - `notify_delivery_message_event`
  - `notify_delivery_verification_event`
- Admin has full RLS access policies for delivery tables.

## Notifications Rules

- Central table: `notifications`
- Includes deep link support with `link` column.
- Market notifications helper functions:
  - `create_market_notification`
  - `notify_market_admins_with_link`
  - `market_order_route`

## Frontend Rebuild Principles

1. UI must not compute critical money/status logic; always rely on RPCs.
2. Every important event should produce a notification with a routeable `link`.
3. Role-based views must follow backend RLS and transition rules.
4. Frontend should wrap every RPC in typed service functions.
5. Product page should be a dedicated landing page shared by buyer and admin review.

