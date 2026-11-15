import { friendlyEmailError } from "@/lib/email-notice";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useWebMCP } from "use-webmcp-tool";
import { Wallet, Search, Plus, ArrowUpRight, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { accountOptions, useAccount } from "@/lib/account";
import {
  configureWallet,
  topUpWallet,
  runFinance,
  confirmTransfer,
  cancelTransfer,
} from "@/lib/finance.functions";
import { fakeAmount } from "@/lib/finance-validation";
import { inr } from "@/lib/mock";
import { seo } from "@/lib/seo";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";
import { PendingCollections } from "@/components/app/PendingCollections";
export const Route = createFileRoute("/_authenticated/wallet")({
  head: () =>
    seo(
      "Wallet — payIQ",
      "Manage available balance and reviewed wallet transfers.",
    ),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountOptions),
  component: WalletPage,
});
function WalletPage() {
  const a = useAccount();
  const qc = useQueryClient();
  const config = useServerFn(configureWallet);
  const topup = useServerFn(topUpWallet);
  const run = useServerFn(runFinance);
  const confirm = useServerFn(confirmTransfer);
  const cancel = useServerFn(cancelTransfer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [funds, setFunds] = useState("1000");
  const [phone, setPhone] = useState(a.wallet?.phone ?? "");
  const [upi, setUpi] = useState(a.wallet?.upi_id ?? "");
  const [discoverable, setDiscoverable] = useState(a.wallet?.discoverable ?? true);
  const [person, setPerson] = useState<{ name: string; alias: string } | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["account"] });
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not complete request";
      setError(message);
      toast.error(message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  useWebMCP({
    name: "read_simulation_wallet",
    description: "Read the visible available balance and pending request count.",
    annotations: { readOnlyHint: true },
    execute: () =>
      runWebMCPTool(
        "read_simulation_wallet",
        () =>
          `Available balance ${inr(a.wallet?.balance ?? 0)}; ${a.transfers.filter((t) => t.status === "AWAITING_USER_AUTH").length} pending requests. No real money.`,
      ),
  });
  const pending = a.transfers.filter((t) => t.status === "AWAITING_USER_AUTH" && !a.pendingCollections.some((r) => r.id === t.id));
  const selected = pending.find((t) => t.id === review);
  return (
    <AppShell title="Wallet" subtitle="Simulated funds · real payments disconnected">
      <PendingCollections />
      <section className="border-b pb-6">
        <div className="flex items-center gap-2 text-sky">
          <Wallet className="size-5" />
          <span className="text-sm font-semibold">Available balance</span>
        </div>
        <p className="my-3 font-display text-4xl font-bold">{inr(a.wallet?.balance ?? 0)}</p>
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              await topup({ data: fakeAmount.parse(Number(funds)) });
              toast.success("Balance added");
            });
          }}
        >
          <input
            aria-label="Amount (₹)"
            type="number"
            min="0.01"
            max="100000"
            step="0.01"
            required
            value={funds}
            onChange={(e) => setFunds(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3"
          />
          <Button variant="outline" disabled={busy}>
            <Plus />
            Add balance
          </Button>
        </form>
      </section>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-semibold">Send transfer</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const r = await run({
                  data: {
                    tool: "prepare_transfer",
                    args: { query, amount: fakeAmount.parse(Number(amount)) },
                  },
                });
                if ("transfer_id" in r) setReview(r.transfer_id);
              });
            }}
          >
            <label className="block text-sm">
              Account email / phone / UPI alias
              <input
                required
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPerson(null);
                }}
                className="mt-2 h-11 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !query.trim()}
              onClick={() =>
                void action(async () => {
                  const r = await run({ data: { tool: "search_recipient", args: { query } } });
                  if ("recipients" in r) {
                    if (r.recipients.length !== 1)
                      throw new Error(
                        "No unique match. Ask the recipient to enable account lookup.",
                      );
                    setPerson(r.recipients[0] ?? null);
                  }
                })
              }
            >
              <Search />
              Find user
            </Button>
            {person && (
              <p className="text-sm font-semibold">
                {person.name} · {person.alias}
              </p>
            )}
            <label className="block text-sm">
              Amount (₹)
              <input
                required
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-2 h-11 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <Button variant="brand" disabled={busy || !person}>
              <ArrowUpRight />
              Review transfer
            </Button>
          </form>
        </section>
        <section>
          <h2 className="mb-4 text-lg font-semibold">Your account identity</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void action(() => config({ data: { phone, upi_id: upi, discoverable } }));
            }}
          >
            <label className="block text-sm">
              Account email
              <input readOnly value={a.profile.email} className="mt-2 h-11 w-full rounded-lg border bg-background px-3" />
            </label>
            <label className="block text-sm">
              Phone alias (10–15 digits)
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2 h-11 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <label className="block text-sm">
              UPI alias
              <input
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                placeholder="yourname@simulation"
                className="mt-2 h-11 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              Allow exact email / phone / UPI lookup
              <Switch checked={discoverable} onCheckedChange={setDiscoverable} />
            </label>
            <p className="text-xs text-muted-foreground">
              Opting in shares your name and matched alias with signed-in users, never your balance.
            </p>
            <Button variant="outline" disabled={busy}>
              Save identity
            </Button>
          </form>
        </section>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <section className="mt-8 border-t pt-6">
        <h2 className="mb-4 text-lg font-semibold">Pending requests</h2>
        {pending.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending transfers.</p>
        )}
        {pending.map((t) => (
          <div
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b py-4"
          >
            <div>
              <p className="font-semibold">
                {inr(t.amount)} · {t.payer_id === a.profile.id ? "You pay" : "You receive"}
              </p>
              <p className="text-xs text-muted-foreground break-all">Request {t.id}</p>
            </div>
            <div className="flex gap-2">
              {t.payer_id === a.profile.id && (
                <Button variant="brand" disabled={busy} onClick={() => setReview(t.id)}>
                  Review
                </Button>
              )}
              {(t.requester_id === a.profile.id || t.payer_id === a.profile.id) && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void action(() => cancel({ data: t.id }))}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Review transfer"
          className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-4"
        >
          <section className="w-full max-w-md rounded-lg border bg-background p-6 shadow-soft">
            <ShieldCheck className="size-8 text-sky" />
            <h2 className="mt-3 text-xl font-semibold">Review transfer</h2>
            <p className="my-4 text-3xl font-bold">{inr(selected.amount)}</p>
            <p className="mb-2 break-all text-xs">Recipient account: {selected.recipient_id}</p>
            <p className="mb-5 text-sm text-muted-foreground">
              This deducts the amount from your wallet and credits the recipient. Funds remain simulated; no bank payment occurs.
            </p>
            {error && (
              <p role="alert" className="mb-3 text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="brand"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const result = await confirm({ data: selected.id });
                    setReview(null);
                    if (result.notification.status === "SENT") toast.success("Email dispatched by Resend");
                    if (result.notification.status === "FAILED") toast.warning(friendlyEmailError(result.notification.error));
                    if (result.error) throw new Error(result.error);
                    toast.success("Transfer completed");
                  })
                }
              >
                Send transfer
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setReview(null)}>
                Back
              </Button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
