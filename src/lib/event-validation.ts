import { z } from "zod";
export const accountEventSchema = z.object({
  type: z.enum(["INSERT", "UPDATE"]),
  table: z.enum(["transactions", "sync_requests"]),
  schema: z.literal("public"),
  record: z.object({ id: z.string().uuid(), user_id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }) }).passthrough(),
  old_record: z.record(z.unknown()).nullable().optional(),
});
export function eventRequiresEmail(event: z.infer<typeof accountEventSchema>) {
  if (event.table === "sync_requests") return event.type === "UPDATE" && event.old_record?.["status"] !== event.record["status"];
  return event.type === "INSERT" || event.old_record?.["status"] !== event.record["status"] || event.old_record?.["retry_count"] !== event.record["retry_count"];
}