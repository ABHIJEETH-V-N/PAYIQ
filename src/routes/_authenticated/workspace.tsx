import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Trash2, Sparkles, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { accountOptions, useAccount } from "@/lib/account";
import { clearMessages, createSync } from "@/lib/data.functions";
import { runFinance } from "@/lib/finance.functions";
import { isReviewedCommand, type FinanceCommand } from "@/lib/finance-validation";
import { downloadFinanceExport } from "@/lib/finance-export";
import { askAssistant } from "@/lib/assistant.functions";
import type { AssistantResult } from "@/lib/assistant-validation";
import { VoiceInput } from "@/components/app/VoiceInput";
import { inr } from "@/lib/mock";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/_authenticated/workspace")({
  head: () =>
    seo("IQ — payIQ", "Type or speak to your finance companion in payIQ."),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountOptions),
  component: Workspace,
});
function Workspace() {
  const { messages, policies, profile } = useAccount();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const ask = useServerFn(askAssistant);
  const run = useServerFn(runFinance);
  const [command, setCommand] = useState<FinanceCommand | null>(null);
  const clear = useServerFn(clearMessages);
  const saveDraft = useServerFn(createSync);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [pending, setPending] = useState<AssistantResult["draft"]>(null);
  const [error, setError] = useState("");
  const [senderEmail, setSenderEmail] = useState(profile.email);
  const [policyId, setPolicyId] = useState(
    policies.find((p) => p.requires_user_auth)?.id ?? policies[0]?.id ?? "",
  );
  const refresh = () => qc.invalidateQueries({ queryKey: ["account"] });
  return (
    <AppShell
      title="IQ"
      action={
        messages.length > 0 && (
          <Button
            variant="ghost"
            disabled={busy || voiceBusy}
            onClick={async () => {
              setBusy(true);
              try {
                await clear();
                setPending(null);
                setError("");
                await refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not clear chat");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 />
            Clear chat
          </Button>
        )
      }
    >
      <div className="mx-auto max-w-3xl space-y-4 pb-36">
        {messages.length === 0 && (
          <div className="py-12 text-center">
            <Sparkles className="mx-auto size-10 text-sky" />
            <h2 className="mt-4 text-xl font-semibold">Your conversations</h2>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm",
                m.role === "user" ? "bg-secondary" : "glass",
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
        {busy && (
          <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Working on your request…
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {command && (
          <section className="rounded-lg border bg-background p-4">
            <h2 className="font-semibold">
              Review{" "}
              {command.tool === "prepare_transfer"
                ? "transfer"
                : command.tool === "create_sync_request"
                  ? "Smart Transfer draft"
                  : "new policy"}
            </h2>
            <pre className="my-3 overflow-auto whitespace-pre-wrap text-sm">
              {JSON.stringify(command.args, null, 2)}
            </pre>
            <div className="flex gap-2">
              <Button
                variant="brand"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await run({ data: command });
                    setCommand(null);
                    await refresh();
                    if (command.tool === "prepare_transfer") await navigate({ to: "/wallet" });
                    else
                      toast.success(
                        command.tool === "create_sync_request"
                          ? "Smart Transfer draft saved"
                          : "Policy saved",
                      );
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Confirm{" "}
                {command.tool === "prepare_transfer" ? "prepare transfer" : "save policy"}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setCommand(null)}>
                Dismiss
              </Button>
            </div>
          </section>
        )}
        {pending && (
          <section className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-4 text-sky" />
                Review draft
              </h2>
              <Button
                aria-label="Dismiss draft"
                title="Dismiss draft"
                variant="ghost"
                size="icon"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                <X />
              </Button>
            </div>
            <dl className="my-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="break-words">{pending.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-semibold">{inr(pending.amount)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {pending.direction === "DEBIT" ? "Pay to" : "Collect from"}
                </dt>
                <dd className="break-words">{pending.counterparty}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">UPI ID / Phone</dt>
                <dd className="break-all">{pending.counterparty_address}</dd>
              </div>
            </dl>
            <label className="block text-sm">
              Policy
              <select
                aria-label="Draft policy"
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border bg-background px-3"
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="my-3 text-sm text-muted-foreground">Confirming runs this Smart Transfer under the selected policy. Collections need payer approval; eligible payouts debit your wallet. Funds are simulated.</p>
            <label className="mb-3 block text-sm">
              Sender email (reply-to)
              <input
                type="email"
                required
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <Button
              variant="brand"
              disabled={busy || voiceBusy || !policyId}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await saveDraft({
                    data: {
                      ...pending,
                      counterparty_email: "",
                      sender_email: senderEmail,
                      email_updates: true,
                      amount_type: "FIXED",
                      max_cap: null,
                      policy_id: policyId,
                    },
                  });
                  setPending(null);
                  await refresh();
                  toast.success("Smart Transfer saved");
                  await navigate({ to: "/sync-requests" });
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not save draft.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm Smart Transfer
            </Button>
          </section>
        )}
      </div>
      <form
        className="fixed inset-x-0 bottom-24 z-30 px-3 lg:bottom-6 lg:left-64"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!input.trim() || busy || voiceBusy) return;
          setBusy(true);
          setError("");
          setPending(null);
          try {
            const result = await ask({ data: { text: input } });
            setInput("");
            await refresh();
            setCommand(
              result.action === "finance" && result.command && isReviewedCommand(result.command)
                ? result.command
                : null,
            );
            if (
              "financeResult" in result &&
              result.financeResult &&
              typeof result.financeResult === "object" &&
              "filename" in result.financeResult &&
              "mime" in result.financeResult
            )
              downloadFinanceExport(
                result.financeResult as {
                  filename: string;
                  mime: string;
                  text?: string;
                  base64?: string;
                },
              );
            if (result.action === "draft_sync") setPending(result.draft);
            if (result.action === "navigate" && result.destination)
              await navigate({ to: result.destination });
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not process your request.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-3xl glass p-2 pl-5">
          <textarea
            aria-label="Message"
            value={input}
            rows={2}
            maxLength={10000}
            disabled={busy || voiceBusy}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask payIQ…"
            className="min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none"
          />
          <VoiceInput disabled={busy || voiceBusy} onText={setInput} onBusy={setVoiceBusy} />
          <Button
            aria-label="Send request"
            title="Send request"
            variant="brand"
            size="icon"
            disabled={busy || voiceBusy || !input.trim()}
          >
            <ArrowUp />
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
