import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  ledgerFilterSchema,
  financeCommandSchema,
  type FinanceCommand,
} from "./finance-validation";
type DB = SupabaseClient<Database>;
export async function queryLedger(db: DB, input: unknown) {
  const f = ledgerFilterSchema.parse(input);
  let q = db
    .from("transactions")
    .select(
      "id,order_id,from_party,to_party,amount,direction,status,retry_count,bank_error,source_type,created_at,is_simulated",
    )
    .order("created_at", { ascending: false });
  if (f.from_party) q = q.ilike("from_party", `%${f.from_party.replace(/[%_]/g, "")}%`);
  if (f.to_party) q = q.ilike("to_party", `%${f.to_party.replace(/[%_]/g, "")}%`);
  if (f.party) {
    const p = f.party.replace(/[,%_().]/g, "");
    q = q.or(`from_party.ilike.%${p}%,to_party.ilike.%${p}%`);
  }
  if (f.status && f.status !== "ALL") q = q.eq("status", f.status);
  if (f.direction) q = q.eq("direction", f.direction);
  if (f.source_type) q = q.eq("source_type", f.source_type);
  if (f.from_date) q = q.gte("created_at", `${f.from_date}T00:00:00+05:30`);
  if (f.to_date)
    q = q.lt(
      "created_at",
      new Date(new Date(`${f.to_date}T00:00:00+05:30`).getTime() + 86400000).toISOString(),
    );
  if (f.min_amount !== undefined) q = q.gte("amount", f.min_amount);
  if (f.max_amount !== undefined) q = q.lte("amount", f.max_amount);
  const r = await q.limit(f.limit);
  if (r.error) throw new Error(r.error.message);
  return r.data ?? [];
}
export async function executeFinance(db: DB, owner: string, raw: FinanceCommand) {
  const c = financeCommandSchema.parse(raw);
  if (c.tool === "create_sync_request") {
    if (c.args.new_policy || !c.args.policy_id)
      throw new Error("Choose an existing policy for agent-created drafts.");
    const { new_policy, ...args } = c.args;
    const r = await db
      .from("sync_requests")
      .insert({ ...args, policy_id: c.args.policy_id, user_id: owner, status: "DRAFT" })
      .select("id,name,status,amount,direction")
      .single();
    if (r.error) throw new Error(r.error.message);
    if (c.args.email_updates) {
      const { notifyAccount } = await import("./notifications.server");
      await notifyAccount(
        db,
        owner,
        `sync-created-${r.data.id}`,
        "Smart Transfer created",
        [
          ["Request", r.data.name],
          ["Status", "Draft · no money moved"],
        ],
        c.args.sender_email || undefined,
        c.args.counterparty_email || undefined,
        r.data.id,
      );
    }
    return {
      sync: r.data,
      limitation:
        "Draft only. Prepare a simulation from Smart Transfers; payer must confirm in Wallet.",
    };
  }
  if (c.tool === "query_ledger") return { rows: await queryLedger(db, c.args) };
  if (c.tool === "get_wallet") {
    const r = await db
      .from("simulation_wallets")
      .select("balance,phone,upi_id,discoverable")
      .eq("user_id", owner)
      .single();
    if (r.error) throw new Error(r.error.message);
    return { wallet: r.data, simulation: true };
  }
  if (c.tool === "list_policies") {
    const r = await db
      .from("payment_policies")
      .select("id,name,requires_user_auth,max_retries,auto_refund_limit,auto_email,frequency,execution_date,auto_approve_limit,retry_delay_seconds")
      .eq("user_id", owner);
    if (r.error) throw new Error(r.error.message);
    return { policies: r.data };
  }
  if (c.tool === "search_recipient" || c.tool === "prepare_transfer") {
    const r = await db.rpc("search_simulation_recipient", { p_query: c.args.query });
    if (r.error) throw new Error(r.error.message);
    if (c.tool === "search_recipient") return { recipients: r.data };
    if (r.data.length !== 1)
      throw new Error("Enter an exact account email, account phone or UPI alias with one match.");
    const recipient = r.data[0];
    if (!recipient) throw new Error("Recipient not found");
    const p = await db.rpc("prepare_simulation_transfer", {
      p_recipient: recipient.user_id,
      p_amount: c.args.amount,
    });
    if (p.error) throw new Error(p.error.message);
    return {
      transfer_id: p.data,
      recipient: recipient.name,
      amount: c.args.amount,
      status: "AWAITING_USER_AUTH",
      simulation: true,
    };
  }
  if (c.tool === "create_policy") {
    const r = await db
      .from("payment_policies")
      .insert({ ...c.args, user_id: owner })
      .select("id,name,requires_user_auth,max_retries,auto_refund_limit,auto_email,frequency,execution_date,auto_approve_limit,retry_delay_seconds")
      .single();
    if (r.error) throw new Error(r.error.message);
    return { policy: r.data };
  }
  if (c.tool === "search_knowledge_base") {
    const r = await db
      .from("knowledge_documents")
      .select("id,filename,status")
      .eq("user_id", owner)
      .ilike("filename", `%${c.args.query.replace(/[%_]/g, "")}%`)
      .limit(20);
    if (r.error) throw new Error(r.error.message);
    return {
      documents: r.data,
      limitation: "Filename search only; document contents are not indexed.",
    };
  }
  let rows = await queryLedger(db, { party: c.args.party, limit: 100 });
  if (c.args.transaction_id) {
    const r = await db
      .from("transactions")
      .select(
        "id,order_id,from_party,to_party,amount,direction,status,retry_count,bank_error,source_type,created_at,is_simulated",
      )
      .eq("id", c.args.transaction_id)
      .single();
    if (r.error) throw new Error("Transaction not found");
    rows = [r.data];
  }
  if (!rows.length) throw new Error("No matching transactions to export.");
  const { createFinanceExport } = await import("./finance-export");
  return createFinanceExport(rows, c.args.format);
}
