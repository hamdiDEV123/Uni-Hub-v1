import { supabase } from "@/integrations/supabase/client";

export type DeliveryMode = "external" | "campus_run";

export interface CreateDeliveryOrderInput {
  title: string;
  campus: string;
  pickup: string;
  dropoff: string;
  fee: number;
  phone: string;
  type?: DeliveryMode;
}

export async function createDeliveryOrderSecure(input: CreateDeliveryOrderInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_delivery_order_secure", {
    _title: input.title,
    _campus: input.campus,
    _pickup: input.pickup,
    _dropoff: input.dropoff,
    _fee: input.fee,
    _phone: input.phone,
    _type: input.type ?? "external",
  });

  if (error) throw error;
  return String(data);
}

export async function claimDeliveryOrderSecure(orderId: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_delivery_order_secure", {
    _order_id: orderId,
  });
  if (error) throw error;
  return String(data);
}

export async function releaseDeliveryOrderSecure(orderId: string): Promise<string> {
  const { data, error } = await supabase.rpc("release_delivery_order_secure", {
    _order_id: orderId,
  });
  if (error) throw error;
  return String(data);
}

export async function completeDeliveryOrderSecure(orderId: string, otp: string): Promise<string> {
  const { data, error } = await supabase.rpc("complete_delivery_order_secure", {
    _order_id: orderId,
    _otp: otp,
  });
  if (error) throw error;
  return String(data);
}
