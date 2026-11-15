import { z } from "zod";
import { syncSchema } from "./account-validation";
import { policyFields } from "./policy-validation";
export const fakeAmount = z
  .number()
  .finite()
  .min(0.01)
  .max(100000)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, "Use at most two decimals");
export const walletSettingsSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^$|^[0-9]{10,15}$/),
  upi_id: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^$|^[a-z0-9._-]+@[a-z0-9.-]+$/),
  discoverable: z.boolean(),
});
export const ledgerFilterSchema = z
  .object({
    party: z.string().trim().max(200).optional(),
    from_party: z.string().max(200).optional(),
    to_party: z.string().max(200).optional(),
    status: z.enum(["ALL", "SUCCESS", "RETRYING", "FAILED"]).optional(),
    direction: z.enum(["DEBIT", "CREDIT"]).optional(),
    source_type: z.enum(["SYNC_REQUEST", "DIRECT_PAYMENT", "WALLET_TRANSFER"]).optional(),
    from_date: z.string().date().optional(),
    to_date: z.string().date().optional(),
    min_amount: z.number().nonnegative().optional(),
    max_amount: z.number().nonnegative().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((v) => !v.from_date || !v.to_date || v.from_date <= v.to_date, "Date range is reversed")
  .refine(
    (v) => v.min_amount === undefined || v.max_amount === undefined || v.min_amount <= v.max_amount,
    "Amount range is reversed",
  );
export const policySchema = z
  .object({
    ...policyFields,
    auto_refund_limit: z.number().min(0).max(100000).default(0),
  })
  .strict();
export const financeCommandSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("create_sync_request"), args: syncSchema }),
  z.object({ tool: z.literal("get_wallet"), args: z.object({}).strict() }),
  z.object({ tool: z.literal("list_policies"), args: z.object({}).strict() }),
  z.object({ tool: z.literal("query_ledger"), args: ledgerFilterSchema }),
  z.object({
    tool: z.literal("search_recipient"),
    args: z.object({ query: z.string().trim().min(3).max(150) }).strict(),
  }),
  z.object({
    tool: z.literal("prepare_transfer"),
    args: z.object({ query: z.string().trim().min(3).max(150), amount: fakeAmount }).strict(),
  }),
  z.object({ tool: z.literal("create_policy"), args: policySchema }),
  z.object({
    tool: z.literal("search_knowledge_base"),
    args: z.object({ query: z.string().trim().min(1).max(200) }).strict(),
  }),
  z.object({
    tool: z.literal("generate_invoice"),
    args: z
      .object({
        transaction_id: z.string().uuid().optional(),
        party: z.string().max(200).optional(),
        format: z.enum(["PDF", "CSV"]).default("PDF"),
      })
      .strict(),
  }),
]);
export type FinanceCommand = z.infer<typeof financeCommandSchema>;
export const isReviewedCommand = (c: FinanceCommand) =>
  c.tool === "create_policy" || c.tool === "prepare_transfer" || c.tool === "create_sync_request";
