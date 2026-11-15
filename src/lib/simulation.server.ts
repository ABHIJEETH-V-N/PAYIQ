import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { notifyTransfer } from "./smart-transfers.server";

export async function completeSimulation(db: SupabaseClient<Database>, owner: string, id: string) {
  const result = await db.rpc("confirm_simulation_transfer", { p_id: id });
  if (result.error) throw new Error(result.error.message);
  const transfer = await db.from("simulation_transfers").select("status,sync_request_id,amount").eq("id", id).single();
  if (transfer.error) throw new Error(transfer.error.message);
  const notification = await notifyTransfer(db, owner, id);
  return { id, status: transfer.data.status, notification, error: transfer.data.status === "FAILED" ? "Transfer failed: insufficient available balance or recipient balance limit. See Ledger." : null };
}