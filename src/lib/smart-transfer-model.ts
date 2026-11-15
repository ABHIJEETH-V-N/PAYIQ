export const reminderOptions = [
  ["NONE", "None"], ["5_HOURS", "Every 5 hours"], ["10_HOURS", "Every 10 hours"],
  ["MORNING", "Every Morning (9:00 AM)"], ["DUE_FAILURE", "On Due / Failure"],
] as const;
export function reminderLabel(value: string) {
  return reminderOptions.find(([key]) => key === value)?.[1] ?? "None";
}
type Transaction = { id: string; created_at: string; status: string; amount: number; is_automated: boolean; source_type: string; sync_request_id: string | null; order_id: string };
type Transfer = { id: string; status: string; sync_request_id: string | null };
export function dashboardMetrics(transactions: Transaction[], transfers: Transfer[], syncs: { id: string; status: string }[], now = new Date()) {
  const date = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const today = transactions.filter((t) => date(new Date(t.created_at)) === date(now) && t.status === "SUCCESS");
  const automated = (t: Transaction) => t.source_type === "SYNC_REQUEST" || (t.source_type !== "WALLET_TRANSFER" && t.is_automated);
  const auto = today.filter(automated).length;
  const attention = new Set<string>();
  transfers.filter((t) => ["AWAITING_USER_AUTH", "FAILED"].includes(t.status)).forEach((t) => attention.add(t.sync_request_id ? `sync-${t.sync_request_id}` : `transfer-${t.id}`));
  syncs.filter((s) => ["AWAITING_USER_AUTH", "FAILED"].includes(s.status)).forEach((s) => attention.add(`sync-${s.id}`));
  transactions.filter((t) => t.status === "FAILED").forEach((t) => {
    const transfer = transfers.find((r) => t.order_id === `SIM-${r.id}-D` || t.order_id === `SIM-${r.id}-C`);
    attention.add(t.sync_request_id ? `sync-${t.sync_request_id}` : transfer?.sync_request_id ? `sync-${transfer.sync_request_id}` : transfer ? `transfer-${transfer.id}` : `transaction-${t.id}`);
  });
  return {
    today_volume: today.reduce((n, t) => n + Number(t.amount), 0), automated_count: auto,
    manual_count: today.length - auto, attention_count: attention.size,
    automation_rate: today.length ? Math.round(auto / today.length * 1000) / 10 : 0,
    hourly: Array.from({ length: 24 }, (_, h) => {
      const rows = today.filter((t) => Number(new Date(t.created_at).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit" })) === h);
      return { h: String(h), auto: rows.filter(automated).length, manual: rows.filter((t) => !automated(t)).length };
    }),
  };
}