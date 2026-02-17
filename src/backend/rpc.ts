import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RpcFunctionName = keyof Database["public"]["Functions"];
type RpcArgs<TName extends RpcFunctionName> =
  Database["public"]["Functions"][TName] extends { Args: infer A } ? A : never;
type RpcReturns<TName extends RpcFunctionName> =
  Database["public"]["Functions"][TName] extends { Returns: infer R } ? R : never;

export async function callRpc<TName extends RpcFunctionName>(
  fn: TName,
  args: RpcArgs<TName>
): Promise<RpcReturns<TName>> {
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    throw error;
  }

  return data as RpcReturns<TName>;
}
