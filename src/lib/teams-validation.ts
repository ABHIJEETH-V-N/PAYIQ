import { z } from "zod";

export const grantableScopes = [
  "read:transactions",
  "read:documents",
  "write:message",
  "write:ticket",
  "write:reversal",
  "write:refund",
] as const;
export const teamSpecSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.enum(["refunds", "collections", "support", "sales", "settlement", "custom"]),
  goal: z.string().trim().min(1).max(2000),
  audience: z.string().trim().min(1).max(300),
  channels: z
    .array(z.enum(["in_app_chat", "email", "whatsapp", "api"]))
    .min(1)
    .max(4),
  tools: z
    .array(
      z.enum([
        "lookup_transaction",
        "read_documents",
        "send_message",
        "escalate_case",
        "ask_iq",
        "reverse_transaction",
        "refund_transaction",
      ]),
    )
    .max(7),
  connections_needed: z
    .array(
      z.object({
        kind: z.enum(["rest", "db_uri", "webhook", "mcp"]),
        purpose: z.string().max(300),
        mode: z.literal("read_only"),
      }),
    )
    .max(8),
  documents_needed: z
    .array(
      z.object({
        name: z.string().min(1).max(150),
        purpose: z.string().min(1).max(500),
        required: z.boolean(),
      }),
    )
    .max(10),
  proposed_limit_paise: z.number().int().nonnegative().max(100000000),
});
export type TeamSpec = z.infer<typeof teamSpecSchema>;
export const grantSchema = z
  .object({
    scope: z.enum(grantableScopes),
    purpose: z.string().trim().min(1).max(500),
    categories: z.string().trim().min(1).max(300),
    limit_per_action_paise: z.number().int().positive().max(100000000).nullable(),
    daily_cap_paise: z.number().int().positive().max(1000000000).nullable(),
    approval: z.enum(["none", "above_limit", "always"]),
  })
  .superRefine((value, ctx) => {
    if (
      ["write:refund", "write:reversal"].includes(value.scope) &&
      (!value.limit_per_action_paise || !value.daily_cap_paise || value.approval === "none")
    )
      ctx.addIssue({
        code: "custom",
        message: "Money permissions need positive limits and human approval.",
      });
  });

// Applied before persistence and again to every model-bound result.
export function redactTeamText(value: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
  return value
    .replace(/\b(?:postgres(?:ql)?|mysql):\/\/\S+/gi, "[REDACTED CONNECTION]")
    .replace(/\b(?:Bearer\s+\S+|(?:sk_|gsk_|sb_secret_)[\w-]+)\b/gi, "[REDACTED SECRET]")
    .replace(/\b(password|passwd|otp|api[ _-]?key|token)\s*[:=]?\s*\S+/gi, "$1 [REDACTED]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[REDACTED PAN]")
    .replace(/\b(?:\d[ -]?){10,19}\b/g, "[REDACTED NUMBER]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[REDACTED EMAIL]");
}
export function maskTeamData(value: unknown): unknown {
  if (typeof value === "string") return redactTeamText(value);
  if (Array.isArray(value)) return value.map(maskTeamData);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/secret|token|password|authorization|account_number/i.test(key))
        .map(([key, item]) => [key, maskTeamData(item)]),
    );
  return value;
}

export type ScopeGrant = z.infer<typeof grantSchema> & {
  expires_at: string;
  revoked: boolean;
  granted_by: string;
};
export type TeamGateInput = {
  active: boolean;
  stopped: boolean;
  toolAllowed: boolean;
  grant?: ScopeGrant | undefined;
  money: boolean;
  amountPaise: number;
  spentPaise: number;
  writeConnection: boolean;
  stepUp: boolean;
  approved: boolean;
  approver?: string;
  now?: number;
};
export function teamGate(input: TeamGateInput): string | null {
  if (!input.active) return "inactive";
  if (!input.toolAllowed) return "tool_not_allowed";
  const scope = input.grant;
  if (
    !scope ||
    scope.revoked ||
    !Number.isFinite(Date.parse(scope.expires_at)) ||
    Date.parse(scope.expires_at) <= (input.now ?? Date.now())
  )
    return "scope_missing_or_expired";
  if (!input.writeConnection) return "connection_read_only";
  if (input.money && (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0))
    return "invalid_amount";
  if (scope.limit_per_action_paise !== null && input.amountPaise > scope.limit_per_action_paise)
    return "per_action_limit";
  if (
    scope.daily_cap_paise !== null &&
    input.amountPaise + input.spentPaise > scope.daily_cap_paise
  )
    return "daily_cap";
  if (input.stopped) return "kill_switch";
  if (
    input.money &&
    input.amountPaise > 1000000 &&
    (!input.approver || input.approver === scope.granted_by)
  )
    return "maker_checker";
  if (scope.approval === "always" && !input.approved) return "approval_required";
  if (input.money && !input.stepUp) return "requires_step_up";
  return null;
}

export const templates = [
  {
    role: "refunds",
    name: "Refund Resolver",
    goal: "Review failed payments and escalate refund requests within human-set rules.",
    document: "Refund policy",
    purpose: "Defines which requests qualify for a refund.",
    tools: ["lookup_transaction", "reverse_transaction", "escalate_case", "ask_iq"],
  },
  {
    role: "collections",
    name: "Collections Agent",
    goal: "Review overdue collections and prepare customer reminder drafts.",
    document: "Overdue schedule",
    purpose: "Defines due dates and outstanding amounts.",
    tools: ["lookup_transaction", "read_documents", "send_message", "escalate_case", "ask_iq"],
  },
  {
    role: "support",
    name: "Support Triage",
    goal: "Answer customer questions from approved knowledge and escalate unresolved cases.",
    document: "FAQ and escalation contacts",
    purpose: "Provides approved answers and human handoff rules.",
    tools: ["read_documents", "escalate_case", "ask_iq"],
  },
  {
    role: "sales",
    name: "Sales Follow-up",
    goal: "Prepare follow-up drafts using the approved product catalogue.",
    document: "Product catalogue",
    purpose: "Keeps product details and prices grounded.",
    tools: ["read_documents", "send_message", "escalate_case", "ask_iq"],
  },
  {
    role: "settlement",
    name: "Settlement Assistant",
    goal: "Review simulated ledger activity and highlight reconciliation questions.",
    document: "Settlement report format",
    purpose: "Defines the report layout and matching rules.",
    tools: ["lookup_transaction", "read_documents", "escalate_case", "ask_iq"],
  },
  {
    role: "custom",
    name: "Custom Teammate",
    goal: "Help with the reviewed job description using explicitly granted access.",
    document: "Job rules",
    purpose: "Defines the teammate’s responsibilities and escalation rules.",
    tools: ["read_documents", "escalate_case", "ask_iq"],
  },
] as const;

export const builderQuestions = [
  {
    key: "purpose",
    question: "What should your teammate do?",
    chips: ["Resolve refunds", "Follow up collections", "Triage support"],
  },
  {
    key: "audience",
    question: "Who will this teammate help?",
    chips: ["My customers", "My business", "My team"],
  },
  {
    key: "channels",
    question: "Where should it work?",
    chips: ["In-app chat", "Email", "WhatsApp"],
  },
  {
    key: "reads",
    question: "Which systems should it read?",
    chips: ["payIQ records only", "Order API", "Read-only database"],
  },
  {
    key: "writes",
    question: "Where may it prepare actions?",
    chips: ["Drafts only", "Support queue", "Refund reviews"],
  },
  {
    key: "limit",
    question: "What amount should require your approval?",
    chips: ["Every action", "₹500", "₹1,000"],
  },
  {
    key: "documents",
    question: "Which document should guide its work?",
    chips: ["Use template requirements", "My business rules", "A custom document"],
  },
] as const;
