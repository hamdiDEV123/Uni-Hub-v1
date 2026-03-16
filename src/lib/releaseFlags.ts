export type ReleaseFlagKey =
  | "marketplaceCheckoutEnabled"
  | "marketplaceOrdersEnabled"
  | "adminMarketplaceV2Enabled";

export type ReleaseFlags = Record<ReleaseFlagKey, boolean>;

const DEFAULT_FLAGS: ReleaseFlags = {
  marketplaceCheckoutEnabled: true,
  marketplaceOrdersEnabled: true,
  adminMarketplaceV2Enabled: true,
};

const LOCAL_STORAGE_KEY = "unihub.releaseFlags";

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "off") return false;
  return undefined;
}

function getEnvOverrides(): Partial<ReleaseFlags> {
  return {
    marketplaceCheckoutEnabled:
      parseBoolean(import.meta.env.VITE_FLAG_MARKETPLACE_CHECKOUT_ENABLED) ?? DEFAULT_FLAGS.marketplaceCheckoutEnabled,
    marketplaceOrdersEnabled:
      parseBoolean(import.meta.env.VITE_FLAG_MARKETPLACE_ORDERS_ENABLED) ?? DEFAULT_FLAGS.marketplaceOrdersEnabled,
    adminMarketplaceV2Enabled:
      parseBoolean(import.meta.env.VITE_FLAG_ADMIN_MARKETPLACE_V2_ENABLED) ?? DEFAULT_FLAGS.adminMarketplaceV2Enabled,
  };
}

function getLocalOverrides(): Partial<ReleaseFlags> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<ReleaseFlags>;
    return {
      marketplaceCheckoutEnabled:
        typeof parsed.marketplaceCheckoutEnabled === "boolean" ? parsed.marketplaceCheckoutEnabled : undefined,
      marketplaceOrdersEnabled:
        typeof parsed.marketplaceOrdersEnabled === "boolean" ? parsed.marketplaceOrdersEnabled : undefined,
      adminMarketplaceV2Enabled:
        typeof parsed.adminMarketplaceV2Enabled === "boolean" ? parsed.adminMarketplaceV2Enabled : undefined,
    };
  } catch {
    return {};
  }
}

export function getReleaseFlags(): ReleaseFlags {
  const envOverrides = getEnvOverrides();
  const localOverrides = getLocalOverrides();

  return {
    ...DEFAULT_FLAGS,
    ...envOverrides,
    ...localOverrides,
  };
}

export function isReleaseFlagEnabled(flag: ReleaseFlagKey): boolean {
  return getReleaseFlags()[flag];
}
