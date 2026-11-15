import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { notifyAccount } from "./notifications.server";

export async function dispatchReminder(db: SupabaseClient<Database>, row: Tables<"notifications">) {
  if (!row.send_email) return { status: "OFF" as const };
  if (!row.sync_request_id) throw new Error("Smart Transfer unavailable");
  const sync = await db.from("sync_requests").select("*").eq("id", row.sync_request_id).single();
  if (sync.error) throw new Error(sync.error.message);
  const s = sync.data;
  const sender = await db.from("profiles").select("name").eq("id", s.user_id).single();
  let amount = s.amount;
  if (row.related_id) {
    const transfer = await db.from("simulation_transfers").select("amount").eq("id", row.related_id).single();
    if (transfer.error) throw new Error(transfer.error.message);
    amount = transfer.data.amount;
  }
  return notifyAccount(db, row.user_id, `reminder-${row.id}`, "Smart Transfer reminder", [
    ["Transfer", s.name], ["Sender", sender.data?.name || "A payIQ user"],
    ["Amount", amount === null ? "Variable" : `₹${amount}`], ["Cap", s.max_cap === null ? "No cap" : `₹${s.max_cap}`],
    ["Due status", s.status], ["Next execution", s.next_execution_at ? new Date(s.next_execution_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Now / awaiting approval"],
    ["Funds", "Simulated funds · real payments disconnected"],
  ], s.sender_email || undefined, undefined, s.id);
}