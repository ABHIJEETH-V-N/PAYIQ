export type TxStatus = "SUCCESS" | "RETRYING" | "FAILED";
export type SyncStatus = "ACTIVE" | "RETRYING_1_OF_2" | "FAILED" | "AWAITING_USER_AUTH";

export const merchant = {
  name: "Sharma Kirana & Co.",
  email: "ops@sharmakirana.in",
  phone: "+91 98450 12345",
  paytm_number: "98450 12345",
  upi_id: "sharmakirana@paytm",
};

export const dashboard = {
  today_volume: 48500,
  automated_count: 29,
  manual_count: 3,
  automation_rate: 90.6,
  hourly: [
    { h: "9a", auto: 2, manual: 0 }, { h: "10a", auto: 4, manual: 1 }, { h: "11a", auto: 5, manual: 0 },
    { h: "12p", auto: 3, manual: 0 }, { h: "1p", auto: 6, manual: 1 }, { h: "2p", auto: 4, manual: 0 },
    { h: "3p", auto: 5, manual: 1 },
  ],
  recent_activity: [
    { id: "a1", action: "Retried UPI payout", party: "Instamart Vendor", amount: 1850, is_automated: true, time: "2m ago", note: "Attempt 2/2" },
    { id: "a2", action: "Sent failure timeline email", party: "Customer Arun", amount: 420, is_automated: true, time: "6m ago", note: "Refund ETA 2 days" },
    { id: "a3", action: "Awaiting your approval", party: "Delhivery Courier", amount: 3200, is_automated: false, time: "14m ago", note: "Variable amount" },
    { id: "a4", action: "Collected payment", party: "Priya Stores", amount: 6400, is_automated: true, time: "22m ago", note: "Weekly sync" },
    { id: "a5", action: "Settled payout", party: "Swiggy Partner", amount: 12750, is_automated: true, time: "41m ago", note: "Bill-decided amount" },
  ],
};

export const policies = [
  { id: "p1", name: "Standard Auto", requires_user_auth: false, max_retries: 2, auto_email: true },
  { id: "p2", name: "Approve Before Debit", requires_user_auth: true, max_retries: 2, auto_email: true },
];

export type SyncReq = { id: string; name: string; counterparty: string; kind: string; direction: "DEBIT" | "CREDIT"; amount_type: "FIXED" | "VARIABLE"; amount: number | null; max_cap: number | null; last_at: string; created_at: string; policy: string; status: SyncStatus };
export const syncRequests: SyncReq[] = [
  { id: "s1", name: "Swiggy/Instamart Weekly Settlement", counterparty: "Swiggy Partner", kind: "Vendor", direction: "DEBIT", amount_type: "VARIABLE", amount: null as number | null, max_cap: 20000, last_at: "Today, 1:12 PM", created_at: "02 Oct 2026", policy: "Standard Auto", status: "ACTIVE" as SyncStatus },
  { id: "s2", name: "Delhivery Courier Smart Transfer", counterparty: "Delhivery", kind: "Courier", direction: "DEBIT", amount_type: "VARIABLE", amount: 3200, max_cap: 5000, last_at: "Yesterday, 6:40 PM", created_at: "18 Sep 2026", policy: "Approve Before Debit", status: "AWAITING_USER_AUTH" as SyncStatus },
  { id: "s3", name: "Instamart Restock Payout", counterparty: "Instamart Vendor", kind: "Vendor", direction: "DEBIT", amount_type: "FIXED", amount: 1850, max_cap: null, last_at: "Today, 3:02 PM", created_at: "11 Aug 2026", policy: "Standard Auto", status: "RETRYING_1_OF_2" as SyncStatus },
  { id: "s4", name: "Priya Stores Weekly Collection", counterparty: "Priya Stores", kind: "Customer", direction: "CREDIT", amount_type: "FIXED", amount: 6400, max_cap: null, last_at: "Today, 2:30 PM", created_at: "01 Jul 2026", policy: "Standard Auto", status: "ACTIVE" as SyncStatus },
  { id: "s5", name: "Office Rent", counterparty: "Mehta Estates", kind: "Vendor", direction: "DEBIT", amount_type: "FIXED", amount: 25000, max_cap: null, last_at: "01 Nov 2026", created_at: "01 Jan 2026", policy: "Standard Auto", status: "FAILED" as SyncStatus },
];

export type Tx = {
  id: string; order_id: string; bank_ref: string; from_party: string; to_party: string;
  direction: "DEBIT" | "CREDIT"; source_type: "SYNC_REQUEST" | "DIRECT_PAYMENT";
  amount: number; status: TxStatus; retry_count: number; bank_error?: string; created_at: string;
  audit_trail: { t: string; e: string }[];
};

export const ledger: Tx[] = [
  { id: "t1", order_id: "PTM-ORD-90412", bank_ref: "BANK2026111404", from_party: "Sharma Kirana", to_party: "Swiggy Partner", direction: "DEBIT", source_type: "SYNC_REQUEST", amount: 12750, status: "SUCCESS", retry_count: 0, created_at: "2026-11-14 13:12", audit_trail: [{ t: "13:12:02", e: "Initial trigger" }, { t: "13:12:05", e: "TXN_SUCCESS" }] },
  { id: "t2", order_id: "PTM-ORD-90418", bank_ref: "BANK2026111409", from_party: "Sharma Kirana", to_party: "Instamart Vendor", direction: "DEBIT", source_type: "SYNC_REQUEST", amount: 1850, status: "RETRYING", retry_count: 1, bank_error: "RESPCODE 227 · Bank server unavailable", created_at: "2026-11-14 15:02", audit_trail: [{ t: "15:02:00", e: "Initial trigger" }, { t: "15:02:04", e: "Failed · RESPCODE 227" }, { t: "15:07:04", e: "Retry 1 queued" }] },
  { id: "t3", order_id: "PTM-ORD-90402", bank_ref: "BANK2026111388", from_party: "Customer Arun", to_party: "Sharma Kirana", direction: "CREDIT", source_type: "DIRECT_PAYMENT", amount: 420, status: "FAILED", retry_count: 2, bank_error: "RESPCODE 810 · Insufficient balance", created_at: "2026-11-14 11:48", audit_trail: [{ t: "11:48:10", e: "Initial trigger" }, { t: "11:53:10", e: "Retry 1 · Failed" }, { t: "11:58:10", e: "Retry 2 · Failed" }, { t: "11:58:14", e: "Failure timeline email sent" }] },
  { id: "t4", order_id: "PTM-ORD-90399", bank_ref: "BANK2026111372", from_party: "Priya Stores", to_party: "Sharma Kirana", direction: "CREDIT", source_type: "SYNC_REQUEST", amount: 6400, status: "SUCCESS", retry_count: 0, created_at: "2026-11-14 14:30", audit_trail: [{ t: "14:30:00", e: "Initial trigger" }, { t: "14:30:03", e: "TXN_SUCCESS" }] },
  { id: "t5", order_id: "PTM-ORD-90371", bank_ref: "BANK2026111301", from_party: "Sharma Kirana", to_party: "Delhivery", direction: "DEBIT", source_type: "SYNC_REQUEST", amount: 2980, status: "SUCCESS", retry_count: 1, created_at: "2026-11-13 18:40", audit_trail: [{ t: "18:40:00", e: "Initial trigger" }, { t: "18:40:04", e: "Failed · timeout" }, { t: "18:45:04", e: "Retry 1 · TXN_SUCCESS" }] },
  { id: "t6", order_id: "PTM-ORD-90350", bank_ref: "BANK2026111266", from_party: "Walk-in Customer", to_party: "Sharma Kirana", direction: "CREDIT", source_type: "DIRECT_PAYMENT", amount: 980, status: "SUCCESS", retry_count: 0, created_at: "2026-11-13 10:15", audit_trail: [{ t: "10:15:00", e: "QR payment received" }] },
  { id: "t7", order_id: "PTM-ORD-90311", bank_ref: "BANK2026110102", from_party: "Sharma Kirana", to_party: "Mehta Estates", direction: "DEBIT", source_type: "SYNC_REQUEST", amount: 25000, status: "FAILED", retry_count: 2, bank_error: "RESPCODE 141 · Daily limit exceeded", created_at: "2026-11-01 09:00", audit_trail: [{ t: "09:00:00", e: "Initial trigger" }, { t: "09:05:00", e: "Retry 1 · Failed" }, { t: "09:10:00", e: "Retry 2 · Failed" }, { t: "09:10:03", e: "Escalated to ledger" }] },
];

export const knowledge = [
  { id: "k1", filename: "Swiggy_rate_card_Q4.pdf", file_type: "PDF", status: "INDEXED", uploaded_at: "12 Nov 2026" },
  { id: "k2", filename: "Instamart_bills_Oct.csv", file_type: "CSV", status: "INDEXED", uploaded_at: "05 Nov 2026" },
  { id: "k3", filename: "delhivery_receipt.jpg", file_type: "Image", status: "PROCESSING", uploaded_at: "Today" },
];

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
