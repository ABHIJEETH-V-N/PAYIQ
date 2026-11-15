import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { notifyAccount } from "./notifications.server";

export async function notifyTransfer(db: SupabaseClient<Database>, owner: string, id: string) {
  const transfer = await db.from("simulation_transfers").select("*").eq("id", id).single();
  if (transfer.error) throw new Error(transfer.error.message);
  const t = transfer.data;
  if (![t.requester_id, t.payer_id, t.recipient_id].includes(owner)) throw new Error("Transfer unavailable");
  // Authorize against a caller-visible participant row before accessing counterparties.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sync = t.sync_request_id ? await supabaseAdmin.from("sync_requests").select("*").eq("id", t.sync_request_id).single() : null;
  if (sync?.error) throw new Error(sync.error.message);
  const title = t.status === "SUCCESS" ? "Transfer received" : t.status === "FAILED" ? "Smart Transfer failed" : "Smart Transfer awaiting approval";
  const target = t.status === "AWAITING_USER_AUTH" ? t.payer_id : t.recipient_id;
  const requester = await supabaseAdmin.auth.admin.getUserById(t.requester_id);
  const sender = await supabaseAdmin.from("profiles").select("name").eq("id", t.requester_id).single();
  if (sync?.data?.email_updates === false || (t.status === "FAILED" && sync?.data?.email_updates && !(await supabaseAdmin.from("payment_policies").select("auto_email").eq("id", sync.data.policy_id).single()).data?.auto_email)) return { status: "OFF" as const };
  return notifyAccount(supabaseAdmin, target, `smart-transfer-${id}-${t.status}`, title,
    [["Transfer", sync?.data?.name || "Wallet transfer"], ["Sender", sender.data?.name || "A payIQ user"], ["Amount", `₹${t.amount}`], ["Cap", sync?.data?.max_cap == null ? "No cap" : `₹${sync.data.max_cap}`], ["Status", t.status === "AWAITING_USER_AUTH" ? "Awaiting Approval · open payIQ to Accept & Pay" : t.status], ["Funds", "Simulated funds · real payments disconnected"]],
    sync?.data?.sender_email || requester.data.user?.email, undefined, t.sync_request_id || undefined);
}

export async function executeSmartTransfer(db: SupabaseClient<Database>, owner: string, sync: string, amount?: number) {
  const result = await db.rpc("execute_smart_transfer", { p_sync: sync, ...(amount === undefined ? {} : { p_amount: amount }) });
  if (result.error) throw new Error(result.error.message);
  if (!result.data) return { id: null, status: "DRAFT", notification: { status: "OFF" as const }, error: null };
  const transfer = await db.from("simulation_transfers").select("status").eq("id", result.data).single();
  if (transfer.error) throw new Error(transfer.error.message);
  return { id: result.data, status: transfer.data.status, notification: await notifyTransfer(db, owner, result.data),
    error: transfer.data.status === "FAILED" ? "Transfer failed. Check available balance and Ledger." : null };
}