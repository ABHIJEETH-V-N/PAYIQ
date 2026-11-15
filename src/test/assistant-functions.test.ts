import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";

const { sarvamRequest, generateReply, executeFinance } = vi.hoisted(() => ({
  sarvamRequest: vi.fn(),
  generateReply: vi.fn(),
  executeFinance: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/sarvam.server", () => ({ sarvamRequest }));
vi.mock("@/lib/groq.server", () => ({ generateReply }));
vi.mock("@/lib/finance.server", () => ({ executeFinance }));

import { askAssistant } from "@/lib/assistant.functions";

type TableName = "chat_messages" | "transactions" | "sync_requests";
const transactionColumns = {
  amount: true,
  direction: true,
  status: true,
  from_party: true,
  to_party: true,
  created_at: true,
  is_simulated: true,
} satisfies Partial<Record<keyof Database["public"]["Tables"]["transactions"]["Row"], true>>;

function savedRecords(transactionRows: unknown[] = [], readError = false) {
  const queries: { table: TableName; columns: string; owner: string }[] = [];
  const insert = vi.fn().mockResolvedValue({ error: null });
  const db = {
    from: (table: TableName) => ({
      insert,
      select: (columns: string) => {
        const query = { table, columns, owner: "" };
        queries.push(query);
        const chain = {
          eq: (_column: string, owner: string) => {
            query.owner = owner;
            return chain;
          },
          order: () => chain,
          limit: () =>
            Promise.resolve({
              data: table === "transactions" ? transactionRows : [],
              error:
                readError ||
                (table === "transactions" &&
                  columns.split(",").some((column) => !Object.hasOwn(transactionColumns, column)))
                  ? { message: "Saved-record query failed" }
                  : null,
            }),
        };
        return chain;
      },
    }),
  };
  return { db, queries, insert };
}

const invoke = askAssistant as unknown as (input: {
  data: { text: string };
  context: { supabase: ReturnType<typeof savedRecords>["db"]; userId: string };
}) => Promise<{ reply: string }>;

describe("assistant saved-record lookup", () => {
  beforeEach(() => {
    vi.stubEnv("SARVAM_API_KEY", "test-only-key");
    vi.clearAllMocks();
    sarvamRequest.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reply: "Your latest transaction is 200 rupees.",
              action: "reply",
              destination: null,
              draft: null,
            }),
          },
        },
      ],
    });
    generateReply.mockImplementation(
      async (_u: string, r: { reply: string } | null) => r?.reply ?? "Groq answered directly.",
    );
  });

  it("reads real transaction fields, passes both parties to Sarvam, and saves the conversation", async () => {
    const row = {
      amount: 200,
      direction: "DEBIT",
      status: "SUCCESS",
      from_party: "Me",
      to_party: "Food",
      created_at: "2026-11-14",
    };
    const { db, queries, insert } = savedRecords([row]);
    await expect(
      invoke({
        data: { text: "What is my latest transaction?" },
        context: { supabase: db, userId: "owner" },
      }),
    ).resolves.toHaveProperty("reply");
    expect(queries.find((query) => query.table === "transactions")?.columns).toBe(
      "amount,direction,status,from_party,to_party,created_at,is_simulated",
    );
    expect(queries.every((query) => query.owner === "owner")).toBe(true);
    const body = JSON.parse(sarvamRequest.mock.calls[0]?.[2] ?? "{}");
    expect(body.messages[0].content).toContain(JSON.stringify(row));
    expect(insert).toHaveBeenCalledWith([
      { user_id: "owner", role: "user", text: "What is my latest transaction?", created_at: expect.any(String) },
      { user_id: "owner", role: "ai", text: "Your latest transaction is 200 rupees.", created_at: expect.any(String) },
    ]);
  });

  it("can answer when the account has no saved transactions", async () => {
    const { db, insert } = savedRecords();
    await expect(
      invoke({ data: { text: "Hello" }, context: { supabase: db, userId: "owner" } }),
    ).resolves.toHaveProperty("reply");
    expect(insert).toHaveBeenCalledOnce();
  });

  it("does not call Sarvam or save messages when a record read genuinely fails", async () => {
    const { db, insert } = savedRecords([], true);
    await expect(
      invoke({ data: { text: "Hello" }, context: { supabase: db, userId: "owner" } }),
    ).rejects.toThrow("Could not read your saved records.");
    expect(sarvamRequest).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("shows and saves Groq's reply, not Sarvam's wording", async () => {
    generateReply.mockResolvedValue("Groq wrote this reply.");
    const { db, insert } = savedRecords();
    const result = await invoke({
      data: { text: "Hello" },
      context: { supabase: db, userId: "owner" },
    });
    expect(result.reply).toBe("Groq wrote this reply.");
    expect(insert).toHaveBeenCalledWith([
      { user_id: "owner", role: "user", text: "Hello", created_at: expect.any(String) },
      { user_id: "owner", role: "ai", text: "Groq wrote this reply.", created_at: expect.any(String) },
    ]);
  });

  it("surfaces an error and saves nothing when Groq fails", async () => {
    generateReply.mockRejectedValue(new Error("Groq could not respond. Please try again."));
    const { db, insert } = savedRecords();
    await expect(
      invoke({ data: { text: "Hello" }, context: { supabase: db, userId: "owner" } }),
    ).rejects.toThrow("Groq could not respond. Please try again.");
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { choices: [{ message: { content: "" } }] },
    { choices: [{ message: { content: "   " } }] },
    { choices: [{ message: { content: "invalid JSON" } }] },
  ])("uses Groq without app actions when Sarvam returns unusable content: %j", async (response) => {
    sarvamRequest.mockResolvedValue(response);
    const { db, insert } = savedRecords();
    const result = await invoke({
      data: { text: "Hello" },
      context: { supabase: db, userId: "owner" },
    });
    expect(result).toEqual({
      reply: "Groq answered directly.",
      action: "reply",
      destination: null,
      draft: null,
    });
    expect(generateReply).toHaveBeenCalledWith("Hello", null, {
      transactions: [],
      syncs: [],
      history: [],
    });
    expect(insert).toHaveBeenCalledWith([
      { user_id: "owner", role: "user", text: "Hello", created_at: expect.any(String) },
      { user_id: "owner", role: "ai", text: "Groq answered directly.", created_at: expect.any(String) },
    ]);
  });

  it("continues with Groq and real saved records when Sarvam is unavailable", async () => {
    sarvamRequest.mockRejectedValue(new Error("Provider unavailable"));
    const row = { amount: 200, direction: "DEBIT", to_party: "Food" };
    const { db } = savedRecords([row]);
    await invoke({
      data: { text: "Latest transaction?" },
      context: { supabase: db, userId: "owner" },
    });
    expect(generateReply).toHaveBeenCalledWith("Latest transaction?", null, {
      transactions: [row],
      syncs: [],
      history: [],
    });
  });

  it("preserves validated Sarvam actions while Groq writes the reply", async () => {
    const outcome = {
      reply: "Open your ledger.",
      action: "navigate",
      destination: "/ledger",
      draft: null,
    };
    sarvamRequest.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(outcome) } }],
    });
    generateReply.mockResolvedValue("Here is your ledger.");
    const { db } = savedRecords();
    expect(
      await invoke({ data: { text: "Open ledger" }, context: { supabase: db, userId: "owner" } }),
    ).toEqual({ ...outcome, reply: "Here is your ledger." });
  });
  it("queries finance data before Groq answers ledger questions", async () => {
    const command = { tool: "query_ledger", args: { party: "Bob", limit: 20 } };
    sarvamRequest.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reply: "Checking",
              action: "finance",
              destination: null,
              draft: null,
              command,
            }),
          },
        },
      ],
    });
    const toolResult = { rows: [{ amount: 1500, to_party: "Bob", is_simulated: true }] };
    executeFinance.mockResolvedValue(toolResult);
    const { db } = savedRecords();
    await invoke({
      data: { text: "Payments to Bob?" },
      context: { supabase: db, userId: "owner" },
    });
    expect(executeFinance).toHaveBeenCalledWith(db, "owner", command);
    expect(generateReply.mock.calls[0]?.[2]).toMatchObject({ toolResult });
  });
  it("does not execute fake transfer proposals before review", async () => {
    const command = { tool: "prepare_transfer", args: { query: "bob@sim", amount: 1500 } };
    sarvamRequest.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reply: "Review",
              action: "finance",
              destination: null,
              draft: null,
              command,
            }),
          },
        },
      ],
    });
    const { db } = savedRecords();
    const result = await invoke({
      data: { text: "Send 1500 fake rupees to bob@sim" },
      context: { supabase: db, userId: "owner" },
    });
    expect(executeFinance).not.toHaveBeenCalled();
    expect(result).toMatchObject({ action: "finance", command });
  });
});
