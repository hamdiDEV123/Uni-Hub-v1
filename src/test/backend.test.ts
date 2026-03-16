import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import * as rpc from "@/backend/rpc";
import * as marketplace from "@/backend/marketplaceApi";
import { supabase } from "@/integrations/supabase/client";

// mock the supabase client module so we can spy on rpc calls
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn(),
    },
  };
});

describe("RPC helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return data when no error occurs", async () => {
    const callRpcUntyped = rpc.callRpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<unknown>;
    const mock = supabase.rpc as unknown as Mock;
    mock.mockResolvedValue({ data: 123, error: null });

    const result = await callRpcUntyped("some_fn", { foo: "bar" });
    expect(result).toBe(123);
    expect(mock).toHaveBeenCalledWith("some_fn", { foo: "bar" });
  });

  it("should throw the error when rpc returns an error", async () => {
    const callRpcUntyped = rpc.callRpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<unknown>;
    const mock = supabase.rpc as unknown as Mock;
    const testError = { message: "fail" };
    mock.mockResolvedValue({ data: null, error: testError });

    await expect(callRpcUntyped("some_fn", {})).rejects.toEqual(testError);
  });
});

describe("marketplaceApi functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("addMarketCartItemSecure should return numeric count", async () => {
    const mock = supabase.rpc as unknown as Mock;
    mock.mockResolvedValue({ data: 1, error: null });

    const val = await marketplace.addMarketCartItemSecure("prod-id", 2);
    expect(val).toBe(1);
    expect(mock).toHaveBeenCalledWith("add_market_cart_item_secure", {
      _product_id: "prod-id",
      _quantity: 2,
    });
  });

  it("addMarketCartItemSecure should propagate errors", async () => {
    const mock = supabase.rpc as unknown as Mock;
    const err = { message: "insufficient" };
    mock.mockResolvedValue({ data: null, error: err });

    await expect(marketplace.addMarketCartItemSecure("prod-id")).rejects.toEqual(err);
  });

  it("createMarketProductListingSecure should map input correctly", async () => {
    const mock = supabase.rpc as unknown as Mock;
    mock.mockResolvedValue({ data: "uuid-product", error: null });

    const input: marketplace.CreateMarketProductListingInput = {
      title: "Test",
      category: "Tech" as const,
      price: 100,
      stockQty: 5,
      imageUrls: [],
    };

    const id = await marketplace.createMarketProductListingSecure(input);
    expect(id).toBe("uuid-product");
    expect(mock).toHaveBeenCalledWith("create_market_product_listing_secure", {
      _title: "Test",
      _description: "",
      _category: "Tech",
      _price: 100,
      _stock_qty: 5,
      _product_condition: "used",
      _phone: null,
      _image_urls: [],
      _is_negotiable: false,
    });
  });

  it("vendor helpers should call correct rpc names", async () => {
    const mock = supabase.rpc as unknown as Mock;
    mock.mockResolvedValue({ data: "vendor-uuid", error: null });

    const id = await marketplace.createVendor("u1", "casual", "My Shop");
    expect(id).toBe("vendor-uuid");
    expect(mock).toHaveBeenCalledWith("create_vendor", {
      _user_id: "u1",
      _type: "casual",
      _shop_name: "My Shop",
      _logo_url: null,
      _campus_id: null,
    });

    mock.mockResolvedValue({ data: [], error: null });
    const v = await marketplace.getVendorByUser("u1");
    expect(v).toBeNull();
    expect(mock).toHaveBeenCalledWith("get_vendor_by_user", { _user_id: "u1" });

    mock.mockResolvedValue({ data: 10, error: null });
    const comm = await marketplace.calculateCommission("vid", 100);
    expect(comm).toBe(10);
    expect(mock).toHaveBeenCalledWith("calculate_commission", { _vendor_id: "vid", _order_total: 100 });
  });

  it("recordProductView should insert a row and handle errors", async () => {
    const fakeInsert = vi.fn();
    (supabase.from as unknown as Mock).mockReturnValue({ insert: fakeInsert });
    fakeInsert.mockResolvedValue({ data: null, error: null });

    await expect(marketplace.recordProductView("p1", "u1")).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith("product_views");
    expect(fakeInsert).toHaveBeenCalledWith({ product_id: "p1", user_id: "u1" });

    const err = { message: "fail" };
    fakeInsert.mockResolvedValue({ data: null, error: err });
    await expect(marketplace.recordProductView("p1")).rejects.toEqual(err);
  });

  it("getActiveAds should query the table with time filters", async () => {
    const query = { gte: vi.fn(), lte: vi.fn(), select: vi.fn() };
    (supabase.from as unknown as Mock).mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.lte.mockResolvedValue({ data: [{ id: "a1" }], error: null });

    const ads = await marketplace.getActiveAds();
    expect(ads).toEqual([{ id: "a1" }]);
    expect(supabase.from).toHaveBeenCalledWith("marketplace_ads");
    expect(query.gte).toHaveBeenCalled();
    expect(query.lte).toHaveBeenCalled();

    // simulate error path
    const errorObj = { message: "oops" };
    query.lte.mockResolvedValue({ data: null, error: errorObj });
    await expect(marketplace.getActiveAds()).rejects.toEqual(errorObj);
  });

  it("createMarketplaceAd should insert and return id", async () => {
    const fakeSingle = vi.fn();
    const fakeSelect = vi.fn();
    const fakeInsert = vi.fn();
    (supabase.from as unknown as Mock).mockReturnValue({ insert: fakeInsert });
    fakeInsert.mockReturnValue({ select: fakeSelect });
    fakeSelect.mockReturnValue({ single: fakeSingle });
    fakeSingle.mockResolvedValue({ data: { id: "ad1" }, error: null });

    const id = await marketplace.createMarketplaceAd("v1", "s", "e", 100, "p1");
    expect(id).toBe("ad1");
    expect(fakeInsert).toHaveBeenCalledWith({
      vendor_id: "v1",
      start_at: "s",
      end_at: "e",
      budget: 100,
      product_id: "p1",
    });

    const errorObj2 = { message: "nope" };
    fakeSingle.mockResolvedValue({ data: null, error: errorObj2 });
    await expect(
      marketplace.createMarketplaceAd("v1", "s", "e", 100)
    ).rejects.toEqual(errorObj2);
  });
});
