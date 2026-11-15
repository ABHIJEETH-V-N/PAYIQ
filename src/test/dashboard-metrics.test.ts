import { describe, it, expect } from "vitest";
import { dashboardMetrics } from "@/lib/smart-transfer-model";
const now = new Date("2026-11-14T12:00:00Z");
const tx = (id: string, source: string, status = "SUCCESS") => ({ id, source_type: source, status, amount: 100, is_automated: false, sync_request_id: null, order_id: id, created_at: now.toISOString() });
describe("Dashboard transaction classification", () => {
  it("counts direct Wallet transfers as Manual", () => {
    expect(dashboardMetrics([tx("wallet", "WALLET_TRANSFER")], [], [], now)).toMatchObject({ automated_count: 0, manual_count: 1, automation_rate: 0 });
  });
  it("counts approved collections and executed Smart Transfers as automated", () => {
    const result = dashboardMetrics([tx("collection", "SYNC_REQUEST"), tx("scheduled", "SYNC_REQUEST"), tx("wallet", "WALLET_TRANSFER")], [], [], now);
    expect(result).toMatchObject({ automated_count: 2, manual_count: 1, automation_rate: 66.7 });
    expect(result.hourly[17]).toEqual({ h: "17", auto: 2, manual: 1 });
  });
  it("counts pending/failed requests once in attention, excluding failures from completed charts", () => {
    const result = dashboardMetrics([{ ...tx("failed", "SYNC_REQUEST", "FAILED"), sync_request_id: "sync" }], [{ id: "attempt", sync_request_id: "sync", status: "FAILED" }, { id: "pending", sync_request_id: "collect", status: "AWAITING_USER_AUTH" }], [{ id: "sync", status: "FAILED" }, { id: "collect", status: "AWAITING_USER_AUTH" }], now);
    expect(result).toMatchObject({ attention_count: 2, automated_count: 0, manual_count: 0, today_volume: 0 });
  });
});