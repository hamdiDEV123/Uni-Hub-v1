# Guarded Release Controls

This project now supports guarded rollout switches via feature flags.

## Available Flags

- `VITE_FLAG_MARKETPLACE_CHECKOUT_ENABLED`
  - Controls route: `/marketplace/checkout`
  - When disabled: redirects to `/marketplace`

- `VITE_FLAG_MARKETPLACE_ORDERS_ENABLED`
  - Controls route: `/marketplace/orders`
  - When disabled: redirects to `/marketplace`

- `VITE_FLAG_ADMIN_MARKETPLACE_V2_ENABLED`
  - Controls route: `/admin` and `/admin/marketplace`
  - When disabled: falls back to legacy admin page `src/pages/Admin.tsx`

## Environment Usage

Set values as `true/false` (also supports `1/0`, `on/off`).

Example `.env`:

```env
VITE_FLAG_MARKETPLACE_CHECKOUT_ENABLED=true
VITE_FLAG_MARKETPLACE_ORDERS_ENABLED=true
VITE_FLAG_ADMIN_MARKETPLACE_V2_ENABLED=true
```

## Local Override (Emergency Testing)

You can override flags in browser localStorage without redeploy:

- Key: `unihub.releaseFlags`
- Value (JSON):

```json
{
  "marketplaceCheckoutEnabled": false,
  "marketplaceOrdersEnabled": true,
  "adminMarketplaceV2Enabled": false
}
```

After updating localStorage, refresh the page.

## Priority Order

1. Defaults in code (`src/lib/releaseFlags.ts`)
2. Environment variables
3. `localStorage` overrides (highest priority)
