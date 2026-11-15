import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profileSchema, syncSchema, updateSyncSchema } from "./account-validation";
import { chronologicalMessages } from "./chat-order";
export const getAccountData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const repair = await db.rpc("ensure_simulation_wallet");
    if (repair.error) throw new Error(repair.error.message);
    const incoming = await db.rpc("pending_collection_requests");
    if (incoming.error) throw new Error(incoming.error.message);
    const [p, pol, s, t, e, d, m, u, notices, wallet, transfers] = await Promise.all([
      db.from("profiles").select("*").eq("id", context.userId).single(),
      db.from("payment_policies").select("*").order("created_at"),
      db.from("sync_requests").select("*").order("created_at", { ascending: false }).limit(1000),
      db.from("transactions").select("*").order("created_at", { ascending: false }).limit(1000),
      db.from("transaction_events").select("*").order("created_at").limit(1000),
      db
        .from("knowledge_documents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      db.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(1000),
      db.auth.getUser(),
      db
        .from("email_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      db.from("simulation_wallets").select("*").eq("user_id", context.userId).single(),
      db
        .from("simulation_transfers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    for (const result of [p, pol, s, t, e, d, m, u, notices, wallet, transfers])
      if (result.error) throw new Error(result.error.message);
    if (!p.data) throw new Error("Profile not found");
    return {
      profile: { ...p.data, email: u.data.user?.email ?? "" },
      policies: pol.data ?? [],
      syncs: s.data ?? [],
      transactions: t.data ?? [],
      events: e.data ?? [],
      documents: d.data ?? [],
      messages: chronologicalMessages(m.data ?? []),
      notifications: notices.data ?? [],
      wallet: wallet.data,
      transfers: transfers.data ?? [],
      pendingCollections: incoming.data ?? [],
    };
  });
export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(profileSchema)
  .handler(async ({ data, context }) => {
    const r = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId)
      .select()
      .single();
    if (r.error) throw new Error(r.error.message);
    const { notifyAccount } = await import("./notifications.server");
    await notifyAccount(
      context.supabase,
      context.userId,
      `profile-${r.data.id}-${r.data.updated_at}`,
      "Profile updated",
      [["Name", r.data.name]],
    );
    return r.data;
  });
export const createSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(syncSchema)
  .handler(async ({ data, context }) => {
    let policyId = data.policy_id;
    if (data.new_policy) {
      const p = await context.supabase
        .from("payment_policies")
        .insert({ ...data.new_policy, user_id: context.userId })
        .select()
        .single();
      if (p.error) throw new Error(p.error.message);
      policyId = p.data.id;
    }
    if (!policyId) throw new Error("Choose a policy");
    const { new_policy, policy_id, ...values } = data;
    const r = await context.supabase
      .from("sync_requests")
      .insert({ ...values, policy_id: policyId, user_id: context.userId, status: "DRAFT" })
      .select()
      .single();
    if (r.error) throw new Error(r.error.message);
    if (r.data.amount_type === "FIXED") {
      const { executeSmartTransfer } = await import("./smart-transfers.server");
      try {
        const execution = await executeSmartTransfer(context.supabase, context.userId, r.data.id, r.data.amount ?? undefined);
        return { ...r.data, notification: execution.notification };
      } catch (error) {
        return { ...r.data, notification: { status: "FAILED" as const, error: `Smart Transfer saved as draft: ${error instanceof Error ? error.message : "Execution unavailable"}` } };
      }
    }
    const { notifyAccount } = await import("./notifications.server");
    const notification = r.data.email_updates
      ? await notifyAccount(
          context.supabase,
          context.userId,
          `sync-created-${r.data.id}`,
          "Smart Transfer created",
          [
            ["Request", r.data.name],
            ["Counterparty", r.data.counterparty],
            ["Amount", r.data.amount === null ? "Variable" : `₹${r.data.amount}`],
            ["Status", "Draft · no money moved"],
          ],
          r.data.sender_email || undefined,
          r.data.counterparty_email || undefined,
          r.data.id,
        )
      : { status: "OFF" as const };
    return { ...r.data, notification };
  });
export const updateSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(updateSyncSchema)
  .handler(async ({ data, context }) => {
    const { new_policy, policy_id, ...values } = data.values;
    if (new_policy || !policy_id) throw new Error("Choose an existing policy when editing.");
    const r = await context.supabase
      .from("sync_requests")
      .update({ ...values, policy_id })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (r.error) throw new Error(r.error.message);
    const { notifyAccount } = await import("./notifications.server");
    const notification = r.data.email_updates
      ? await notifyAccount(
          context.supabase,
          context.userId,
          `sync-updated-${r.data.id}-${r.data.updated_at}`,
          "Smart Transfer updated",
          [
            ["Request", r.data.name],
            ["Counterparty", r.data.counterparty],
            ["Amount", r.data.amount === null ? "Variable" : `₹${r.data.amount}`],
            ["Status", r.data.status],
          ],
          r.data.sender_email || undefined,
          r.data.counterparty_email || undefined,
          r.data.id,
        )
      : { status: "OFF" as const };
    return { ...r.data, notification };
  });
export const saveMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ text: z.string().trim().min(1).max(10000) }))
  .handler(async ({ data, context }) => {
    const r = await context.supabase
      .from("chat_messages")
      .insert({ user_id: context.userId, role: "user", text: data.text })
      .select()
      .single();
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const clearMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await context.supabase.from("chat_messages").delete().eq("user_id", context.userId);
    if (r.error) throw new Error(r.error.message);
  });
export const registerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      filename: z.string().min(1).max(255),
      file_type: z.string().min(1),
      storage_path: z.string().min(1),
      size_bytes: z.number().int().positive(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!data.storage_path.startsWith(context.userId + "/")) throw new Error("Invalid file path");
    const r = await context.supabase
      .from("knowledge_documents")
      .insert({ ...data, user_id: context.userId, status: "UPLOADED" })
      .select()
      .single();
    if (r.error) throw new Error(r.error.message);
    const { notifyAccount } = await import("./notifications.server");
    await notifyAccount(
      context.supabase,
      context.userId,
      `document-added-${r.data.id}`,
      "Document uploaded",
      [
        ["File", r.data.filename],
        ["Status", "Uploaded · not indexed"],
      ],
    );
    return r.data;
  });
export const removeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const r = await db
      .from("knowledge_documents")
      .select("storage_path,filename")
      .eq("id", data)
      .eq("user_id", context.userId)
      .single();
    if (r.error) throw new Error(r.error.message);
    const f = await db.storage.from("payiq-documents").remove([r.data.storage_path]);
    if (f.error) throw new Error(f.error.message);
    const d = await db.from("knowledge_documents").delete().eq("id", data);
    if (d.error) throw new Error(d.error.message);
    const { notifyAccount } = await import("./notifications.server");
    await notifyAccount(db, context.userId, `document-removed-${data}`, "Document deleted", [
      ["File", r.data.filename],
    ]);
  });
