import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { smartEmailPresentation, type SmartEmail } from "./smart-email";

export async function loadSmartEmail(db: SupabaseClient<Database>, syncId: string, title: string, details: [string, string][], replyTo?: string): Promise<SmartEmail> {
  const result = await db.from("sync_requests").select("*").eq("id", syncId).single();
  if (result.error) throw new Error(result.error.message);
  const s = result.data;
  const [profile, policy] = await Promise.all([
    db.from("profiles").select("name").eq("id", s.user_id).single(),
    db.from("payment_policies").select("name,max_retries,frequency,execution_date").eq("id", s.policy_id).eq("user_id", s.user_id).single(),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (policy.error) throw new Error(policy.error.message);
  let senderEmail = s.sender_email || replyTo;
  if (!senderEmail) {
    const session = await db.auth.getUser();
    if (session.data.user?.id === s.user_id) senderEmail = session.data.user.email;
    else {
      const owner = await db.auth.admin.getUserById(s.user_id);
      if (owner.error) throw new Error(owner.error.message);
      senderEmail = owner.data.user?.email;
    }
  }
  if (!senderEmail) throw new Error("Sender email unavailable");
  const senderName = profile.data.name || "A payIQ user";
  const direction = s.direction === "CREDIT" ? "Collect" : "Pay out";
  const status = details.find(([key]) => key === "Status")?.[1] || s.status;
  const amount = details.find(([key]) => key === "Amount")?.[1] || (s.amount === null ? "Variable amount" : `₹${Number(s.amount).toLocaleString("en-IN")}`);
  const frequency = { ONCE: "One-time", DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" }[policy.data.frequency] || policy.data.frequency;
  const due = s.next_execution_at ? new Date(s.next_execution_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : policy.data.execution_date || "Run now";
  return {
    senderName, senderEmail, transferName: s.name, amount,
    cap: s.amount_type === "VARIABLE" && s.max_cap !== null ? `₹${Number(s.max_cap).toLocaleString("en-IN")}` : null,
    direction, schedule: `${frequency} · ${due}`, policy: policy.data.name,
    retries: Math.min(2, Math.max(0, policy.data.max_retries)), status,
    ...smartEmailPresentation(title, status, direction, senderName),
  };
}