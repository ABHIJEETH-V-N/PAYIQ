import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fakeAmount, walletSettingsSchema, financeCommandSchema } from "./finance-validation";
export const runFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(financeCommandSchema)
  .handler(async ({ data, context }) => {
    const { executeFinance } = await import("./finance.server");
    return executeFinance(context.supabase, context.userId, data);
  });
export const configureWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(walletSettingsSchema)
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("configure_simulation_wallet", {
      p_phone: data.phone,
      p_upi: data.upi_id,
      p_discoverable: data.discoverable,
    });
    if (r.error) throw new Error(r.error.message);
  });
export const topUpWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(fakeAmount)
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("top_up_simulation_wallet", { p_amount: data });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  });
export const prepareSyncTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), amount: fakeAmount }))
  .handler(async ({ data, context }) => {
    const { executeSmartTransfer } = await import("./smart-transfers.server");
    return executeSmartTransfer(context.supabase, context.userId, data.id, data.amount);
  });
export const confirmTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    const { completeSimulation } = await import("./simulation.server");
    return completeSimulation(context.supabase, context.userId, data);
  });
export const cancelTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("cancel_simulation_transfer", { p_id: data });
    if (r.error) throw new Error(r.error.message);
  });
