export type LedgerRow = {
  id: string; order_id: string; from_party: string; to_party: string;
  from_upi: string; to_upi: string; from_email: string; to_email: string;
  amount: number; direction: string; source_type: string; status: string;
  bank_error: string | null; retry_count: number; description: string;
  created_at: string; is_simulated: boolean; audit_trail: { t: string; e: string }[];
};
export function ledgerDate(value: string) {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
export function filterLedger(rows: LedgerRow[], f: { party: string; status: string; direction: string; source: string; from: string; to: string; min: string; max: string }) {
  const query = f.party.trim().toLowerCase();
  return rows.filter((r) => (!query || [r.from_party,r.to_party,r.from_upi,r.to_upi,r.from_email,r.to_email,r.order_id].some((v) => v.toLowerCase().includes(query))) &&
    (f.status === "ALL" || r.status === f.status) && (f.direction === "ALL" || r.direction === f.direction) &&
    (f.source === "ALL" || r.source_type === f.source || (f.source === "WALLET_TRANSFER" && r.source_type === "DIRECT_PAYMENT")) &&
    (!f.from || ledgerDate(r.created_at) >= f.from) && (!f.to || ledgerDate(r.created_at) <= f.to) &&
    (!f.min || r.amount >= Number(f.min)) && (!f.max || r.amount <= Number(f.max)));
}
export const settledTotal = (rows: { amount: number; status: string }[]) => rows.filter((r) => r.status === "SUCCESS").reduce((sum,r) => sum + r.amount,0);

export function parseAudit(value: unknown): { t: string; e: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null || !("t" in item) || !("e" in item) || typeof item.t !== "string" || typeof item.e !== "string") return [];
    return [{ t: item.t, e: item.e }];
  });
}