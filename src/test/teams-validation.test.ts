import { describe, it, expect } from "vitest";
import { teamsRegionAllowed } from "@/lib/teams-region";
import {
  teamGate,
  grantSchema,
  redactTeamText,
  maskTeamData,
  type TeamGateInput,
  type ScopeGrant,
} from "@/lib/teams-validation";
const grant: ScopeGrant = {
  scope: "write:refund",
  purpose: "Refund reviews",
  categories: "Amounts",
  limit_per_action_paise: 2000000,
  daily_cap_paise: 4000000,
  approval: "always",
  expires_at: "2027-02-13T00:00:00Z",
  granted_by: "maker",
  revoked: false,
};
const base: TeamGateInput = {
  active: true,
  stopped: false,
  toolAllowed: true,
  grant,
  money: true,
  amountPaise: 50000,
  spentPaise: 0,
  writeConnection: true,
  stepUp: true,
  approved: true,
  now: Date.parse("2026-11-15T00:00:00Z"),
};
describe("Teammate permission gate", () => {
  it("preserves non-secret record identifiers", () =>
    expect(maskTeamData({ run_id: "a0000000-0000-4000-8000-000000000001" })).toEqual({
      run_id: "a0000000-0000-4000-8000-000000000001",
    }));
  it("refuses non-India production hosting", () =>
    expect(teamsRegionAllowed(true, "us-east-1")).toBe(false));
  it("refuses unconfigured production hosting", () =>
    expect(teamsRegionAllowed(true, undefined)).toBe(false));
  it("allows configured India production regions", () =>
    expect(teamsRegionAllowed(true, "ap-south-1")).toBe(true));
  it("starts without any granted access", () =>
    expect(teamGate({ ...base, grant: undefined })).toBe("scope_missing_or_expired"));
  it("forbids self-permission scopes", () =>
    expect(grantSchema.safeParse({ ...grant, scope: "write:scope" }).success).toBe(false));
  it("forbids real payout scopes", () =>
    expect(grantSchema.safeParse({ ...grant, scope: "write:payout" }).success).toBe(false));
  it("blocks expired permissions", () =>
    expect(teamGate({ ...base, grant: { ...grant, expires_at: "2026-11-14T00:00:00Z" } })).toBe(
      "scope_missing_or_expired",
    ));
  it("blocks revoked permissions", () =>
    expect(teamGate({ ...base, grant: { ...grant, revoked: true } })).toBe(
      "scope_missing_or_expired",
    ));
  it("enforces per-action cap", () =>
    expect(teamGate({ ...base, amountPaise: 2000001 })).toBe("per_action_limit"));
  it("enforces daily cap", () =>
    expect(teamGate({ ...base, spentPaise: 3999999 })).toBe("daily_cap"));
  it("blocks rule creator above 10000 rupees", () =>
    expect(teamGate({ ...base, amountPaise: 1000001, approver: "maker" })).toBe("maker_checker"));
  it("accepts a different checker above 10000 rupees", () =>
    expect(teamGate({ ...base, amountPaise: 1000001, approver: "checker" })).toBeNull());
  it("requires demo step-up for money", () =>
    expect(teamGate({ ...base, stepUp: false })).toBe("requires_step_up"));
  it("requires human approval", () =>
    expect(teamGate({ ...base, approved: false })).toBe("approval_required"));
  it("pause blocks calls", () => expect(teamGate({ ...base, active: false })).toBe("inactive"));
  it("stop all blocks calls", () =>
    expect(teamGate({ ...base, stopped: true })).toBe("kill_switch"));
  it("read-only connections block writes", () =>
    expect(teamGate({ ...base, writeConnection: false })).toBe("connection_read_only"));
  it("requires declared tools", () =>
    expect(teamGate({ ...base, toolAllowed: false })).toBe("tool_not_allowed"));
  it("money grants require a stated purpose", () =>
    expect(grantSchema.safeParse({ ...grant, purpose: " " }).success).toBe(false));
  it("money grants require a cap", () =>
    expect(grantSchema.safeParse({ ...grant, daily_cap_paise: null }).success).toBe(false));
  it("redacts personal and credential patterns", () => {
    const result = redactTeamText(
      "ABCDE1234F 1234 5678 9012 password: secret-value jane@example.com Bearer private-token",
    );
    for (const value of ["ABCDE1234F", "1234", "secret-value", "jane@example.com", "private-token"])
      expect(result).not.toContain(value);
  });
  it("strips credential fields from model data", () =>
    expect(maskTeamData({ secret_ref: "vault-id", token: "credential", answer: "hello" })).toEqual({
      answer: "hello",
    }));
});
