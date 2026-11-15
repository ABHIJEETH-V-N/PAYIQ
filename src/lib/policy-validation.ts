import { z } from "zod";

export const policyFields = {
  name: z.string().trim().min(1).max(200),
  requires_user_auth: z.boolean(),
  max_retries: z.number().int().min(0).max(2).default(2),
  auto_email: z.boolean().default(true),
  frequency: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY"]).default("ONCE"),
  execution_date: z.string().date().nullable().default(null),
  auto_approve_limit: z.number().min(0).max(100000).nullable().default(null),
  retry_delay_seconds: z.union([z.literal(5), z.literal(900), z.literal(3600)]).default(5),
};