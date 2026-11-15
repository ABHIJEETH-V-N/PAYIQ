import { friendlyEmailError } from "@/lib/email-notice";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type InputHTMLAttributes } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  ShieldCheck,
  Clock,
  CalendarDays,
  Pencil,
  Mail,
  Search,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { lookupRecipient } from "@/lib/incoming.functions";
import { Switch } from "@/components/ui/switch";
import { inr } from "@/lib/mock";
import { useQueryClient } from "@tanstack/react-query";
import { createSync, updateSync } from "@/lib/data.functions";
import { prepareSyncTransfer } from "@/lib/finance.functions";
import { Link } from "@tanstack/react-router";
import { syncSchema } from "@/lib/account-validation";
import { accountOptions, useAccount } from "@/lib/account";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { PendingCollections } from "@/components/app/PendingCollections";
import { reminderOptions, reminderLabel } from "@/lib/smart-transfer-model";
import { sendReminderNow } from "@/lib/reminders.functions";

export const Route = createFileRoute("/_authenticated/sync-requests")({
  head: () =>
    seo("Smart Transfers — payIQ", "Manage automated payouts and collections with custom policies."),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountOptions),
  component: SyncPage,
});

function SyncPage() {
  const account = useAccount();
  const queryClient = useQueryClient();
  const items = account.syncs.map((r) => ({
    ...r,
    policy: account.policies.find((p) => p.id === r.policy_id)?.name ?? "",
    last_at: r.last_at ? new Date(r.last_at).toLocaleString() : "Not run yet",
    created_at: new Date(r.created_at).toLocaleDateString(),
  }));
  const [category, setCategory] = useState<"ALL" | "CREDIT" | "DEBIT">("ALL");
  const remind = useServerFn(sendReminderNow);
  const [reminding, setReminding] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"sync_requests"> | null>(null);
  const prepare = useServerFn(prepareSyncTransfer);
  const [preparing, setPreparing] = useState<string | null>(null);
  const [reviewSync, setReviewSync] = useState<string | null>(null);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [simulationError, setSimulationError] = useState("");

  return (
    <AppShell
      title="Smart Transfers"
      subtitle="Automated payouts and collections executed by AI with up to 2 automatic retry attempts under the attached policy."
      action={
        <Button
          variant="brand"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus /> New Smart Transfer
        </Button>
      }
    >
      <div className="mb-6 max-w-lg"><Segmented value={category} onChange={setCategory} options={[["ALL", "All"], ["CREDIT", "Collectables"], ["DEBIT", "Payouts"]]} /></div>
      {category !== "DEBIT" && <PendingCollections />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.filter((r) => category === "ALL" || r.direction === category).map((r, i) => (
          <article
            key={r.id}
            className="flex flex-col rounded-3xl glass p-5 animate-rise"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-2xl",
                  r.direction === "DEBIT"
                    ? "bg-secondary text-primary"
                    : "bg-success/12 text-success",
                )}
              >
                {r.direction === "DEBIT" ? (
                  <ArrowUpRight className="size-5" />
                ) : (
                  <ArrowDownLeft className="size-5" />
                )}
              </div>
              <StatusPill status={r.status} />
            </div>
            <span className="mt-3 text-xs font-semibold text-muted-foreground">{r.direction === "CREDIT" ? "COLLECTABLE" : "PAYOUT"}</span>
            <h3 className="mt-4 font-semibold leading-snug">{r.name}</h3>
            <p className="text-sm text-muted-foreground">
              {r.counterparty} · {r.kind}
            </p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold">
                {r.amount_type === "FIXED"
                  ? inr(r.amount ?? 0)
                  : r.amount
                    ? inr(r.amount)
                    : "Variable"}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.amount_type === "VARIABLE"
                  ? r.max_cap
                    ? `vendor-decided · cap ${inr(r.max_cap)}`
                    : "vendor-decided · no cap"
                  : "fixed"}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Cap: {r.max_cap === null ? "No cap" : inr(r.max_cap)} · Reminders: {reminderLabel(r.reminder_cadence)}{r.reminder_cadence === "MORNING" ? " IST" : ""}</p>
            {r.next_reminder_at && <p className="mt-1 text-xs text-muted-foreground">Next reminder: {new Date(r.next_reminder_at).toLocaleString()}</p>}
            {r.next_execution_at && <p className="mt-3 text-xs text-muted-foreground">Next execution: {new Date(r.next_execution_at).toLocaleString()}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {r.last_at}
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                Since {r.created_at}
              </div>
              <div className="col-span-2 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                {r.policy}
              </div>
            </dl>
            <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="size-3.5 shrink-0" />
                {r.email_updates ? "Email updates on" : "Email updates off"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(r);
                  setOpen(true);
                }}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
            {!["COMPLETED", "CANCELLED"].includes(r.status) && <Button variant="outline" className="mt-3 w-full" disabled={!!reminding} onClick={async () => {
              setReminding(r.id);
              try { const result = await remind({ data: r.id }); await queryClient.invalidateQueries({ queryKey: ["account"] }); toast.success("App reminder sent"); if (result.notification.status === "SENT") toast.success("Email dispatched by Resend"); if (result.notification.status === "FAILED") toast.warning(friendlyEmailError(result.notification.error)); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Could not send reminder"); } finally { setReminding(null); }
            }}><Mail />{reminding === r.id ? "Sending…" : "Send Reminder Now"}</Button>}
            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={
                !!preparing || ["COMPLETED", "CANCELLED"].includes(r.status) ||
                account.transfers.some(
                  (t) => t.sync_request_id === r.id && (t.status === "AWAITING_USER_AUTH" || (t.status === "SUCCESS" && !r.next_execution_at)),
                )
              }
              onClick={() => {
                setReviewSync(r.id);
                setApprovedAmount(r.amount?.toString() ?? "");
                setSimulationError("");
              }}
            >
              Review {r.direction === "DEBIT" ? "payout" : "collection"}
            </Button>
          </article>
        ))}
      </div>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No saved Smart Transfers yet.</p>
      )}
      {reviewSync && (
        <section
          role="dialog"
          aria-label="Review Smart Transfer"
          className="my-6 rounded-lg border bg-background p-5"
        >
          <h2 className="font-semibold">Review transfer amount</h2>
          <p className="my-2 text-sm text-muted-foreground">
            Simulated funds. Collections require the payer to approve; payouts follow the attached policy.
          </p>
          <input
            aria-label="Amount (₹)"
            type="number"
            min="0.01"
            step="0.01"
            value={approvedAmount}
            onChange={(e) => setApprovedAmount(e.target.value)}
            className="h-11 rounded-lg border bg-background px-3"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="brand"
              disabled={!!preparing}
              onClick={async () => {
                setPreparing(reviewSync);
                try {
                  const result = await prepare({ data: { id: reviewSync, amount: Number(approvedAmount) } });
                  await queryClient.invalidateQueries({ queryKey: ["account"] });
                  setReviewSync(null);
                  if (result.notification.status === "SENT") toast.success("Email dispatched by Resend");
                  if (result.notification.status === "FAILED") toast.warning(friendlyEmailError(result.notification.error));
                  if (result.error) throw new Error(result.error);
                  toast.success(result.status === "SUCCESS" ? "Transfer completed" : "Awaiting Approval. Open Wallet or Notifications to confirm.");
                } catch (e) {
                  const message = e instanceof Error ? e.message : "Could not prepare";
                  setSimulationError(message);
                  toast.error(message);
                } finally {
                  setPreparing(null);
                }
              }}
            >
              Send transfer
            </Button>
            <Button variant="outline" onClick={() => setReviewSync(null)}>
              Back
            </Button>
            <Link to="/wallet" className="text-sm text-sky">
              Open wallet
            </Link>
          </div>
          {simulationError && (
            <p role="alert" className="mt-3 text-destructive">
              {simulationError}
            </p>
          )}
        </section>
      )}
      <NewSync
        key={`${editing?.id ?? "new"}-${open}`}
        initial={editing}
        open={open}
        onOpenChange={setOpen}
        onCreate={async () => {
          await queryClient.invalidateQueries({ queryKey: ["account"] });
          setOpen(false);
          toast.success(editing ? "Smart Transfer updated" : "Smart Transfer saved");
        }}
      />
    </AppShell>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        {...rest}
        className="h-11 w-full rounded-2xl border bg-background px-4 text-sm outline-none focus:border-sky focus:ring-4 focus:ring-sky/15"
      />
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-full bg-secondary p-1">
      {options.map(([v, l]) => (
        <Button
          variant="ghost"
          type="button"
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full py-2 text-sm font-medium text-muted-foreground transition",
            value === v && "bg-background text-foreground shadow-soft",
          )}
        >
          {l}
        </Button>
      ))}
    </div>
  );
}

function NewSync({
  initial,
  open,
  onOpenChange,
  onCreate,
}: {
  initial: Tables<"sync_requests"> | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: () => Promise<void>;
}) {
  const [amountType, setAmountType] = useState<"FIXED" | "VARIABLE">(
    initial?.amount_type === "VARIABLE" ? "VARIABLE" : "FIXED",
  );
  const [direction, setDirection] = useState<"DEBIT" | "CREDIT">(
    initial?.direction === "CREDIT" ? "CREDIT" : "DEBIT",
  );
  const account = useAccount();
  const policies = account.policies;
  const [policy, setPolicy] = useState(initial?.policy_id ?? policies[0]?.id ?? "");
  const save = useServerFn(createSync);
  const update = useServerFn(updateSync);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newPolicy, setNewPolicy] = useState(false);
  const [requireAuth, setRequireAuth] = useState(false);
  const [autoEmail, setAutoEmail] = useState(true);
  const [name, setName] = useState(initial?.name ?? "");
  const lookup = useServerFn(lookupRecipient);
  const [looking, setLooking] = useState(false);
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? "");
  const [recipientEmail, setRecipientEmail] = useState(initial?.counterparty_email ?? "");
  const [recipientAddress, setRecipientAddress] = useState(initial?.counterparty_address ?? "");
  const [frequency, setFrequency] = useState("ONCE");
  const [executionDate, setExecutionDate] = useState<Date>();
  const [retryDelay, setRetryDelay] = useState("5");
  const [emailUpdates, setEmailUpdates] = useState(initial?.email_updates ?? true);
  const [cadence, setCadence] = useState(initial?.reminder_cadence ?? "NONE");
  const [emailReminders, setEmailReminders] = useState(initial?.email_reminders ?? true);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">
            {initial ? "Edit Smart Transfer" : "New Smart Transfer"}
          </SheetTitle>
        </SheetHeader>
        <form
          className="mt-6 space-y-6 px-1 pb-8"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const values = syncSchema.parse({
                name,
                counterparty: String(f.get("counterparty")),
                counterparty_email: String(f.get("counterparty_email") ?? ""),
                sender_email: String(f.get("sender_email") ?? ""),
                email_updates: emailUpdates,
                reminder_cadence: cadence,
                email_reminders: emailReminders,
                counterparty_address: String(f.get("counterparty_address")),
                direction,
                amount_type: amountType,
                amount: amountType === "FIXED" ? Number(f.get("amount")) : null,
                max_cap:
                  amountType === "VARIABLE" && f.get("max_cap") ? Number(f.get("max_cap")) : null,
                policy_id: newPolicy ? undefined : policy,
                new_policy: newPolicy
                  ? {
                      name: String(f.get("policy_name")),
                      requires_user_auth: requireAuth,
                      max_retries: Number(f.get("max_retries")),
                      auto_email: autoEmail,
                      frequency,
                      execution_date: executionDate ? format(executionDate, "yyyy-MM-dd") : null,
                      auto_approve_limit: f.get("auto_approve_limit") ? Number(f.get("auto_approve_limit")) : null,
                      retry_delay_seconds: Number(retryDelay),
                    }
                  : undefined,
              });
              const result = initial
                ? await update({ data: { id: initial.id, values } })
                : await save({ data: values });
              await onCreate();
              if (result.notification.status === "FAILED") toast.warning(friendlyEmailError(result.notification.error));
              if (result.notification.status === "SENT") toast.success("Email dispatched by Resend");
            } catch (error) {
              const message = error instanceof Error ? error.message : "Could not save request";
              setError(message);
              toast.error(message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Input
            label="Request name"
            placeholder="Delhivery Courier Smart Transfer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Counterparty</h4>
            <Input
              name="counterparty"
              label="Name"
              placeholder="Delhivery"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                name="counterparty_email"
                label="Recipient / updates email"
                type="email"
                placeholder="billing@vendor.in"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1"><Input
                name="counterparty_address"
                label="Email / UPI ID / Phone"
                placeholder="pavan@upi"
                value={recipientAddress}
                onChange={(e) => { setRecipientAddress(e.target.value); }}
                required
              /></div>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="User Lookup" title="User Lookup" disabled={looking || !recipientAddress.trim()} onClick={async () => {
                setLooking(true); setError("");
                try { const person = await lookup({ data: recipientAddress }); if (person) { setCounterparty(person.name); setRecipientEmail(person.email); } }
                catch (e) { setError(e instanceof Error ? e.message : "Lookup unavailable"); } finally { setLooking(false); }
              }}><Search /></Button>
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Segmented
              value={direction}
              onChange={setDirection}
              options={[
                ["DEBIT", "Pay out"],
                ["CREDIT", "Collect"],
              ]}
            />
          </section>
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Amount</h4>
            <Segmented
              value={amountType}
              onChange={setAmountType}
              options={[
                ["FIXED", "Fixed amount"],
                ["VARIABLE", "Vendor-decided"],
              ]}
            />
            {amountType === "FIXED" ? (
              <Input
                name="amount"
                min="0.01"
                step="0.01"
                label="Amount (₹)"
                type="number"
                placeholder="1500"
                defaultValue={initial?.amount ?? undefined}
                required
              />
            ) : (
              <Input
                name="max_cap"
                min="0.01"
                step="0.01"
                label="Max cap (₹, optional)"
                type="number"
                placeholder="5000"
                defaultValue={initial?.max_cap ?? undefined}
              />
            )}
          </section>
          <section className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="size-4 text-sky" />
              Email details
            </h4>
            <Input
              name="sender_email"
              label="Sender email (reply-to)"
              type="email"
              defaultValue={initial?.sender_email || account.profile.email}
              required
              maxLength={254}
            />
            <Toggle
              label="Send Smart Transfer email updates"
              checked={emailUpdates}
              onChange={setEmailUpdates}
            />
          </section>
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Reminders &amp; Triggers</h4>
            <label className="block text-sm">Trigger / Reminder Cadence
              <select aria-label="Trigger / Reminder Cadence" value={cadence} onChange={(e) => setCadence(e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3">{reminderOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
            {cadence === "MORNING" && <p className="text-xs text-muted-foreground">9:00 AM · India Standard Time</p>}
            <Toggle label="Email Reminder" checked={emailReminders} onChange={setEmailReminders} />
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Policy</h4>
              {!initial && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setNewPolicy((v) => !v)}
                  className="text-xs font-semibold text-sky"
                >
                  {newPolicy ? "Use existing" : "+ Create new"}
                </Button>
              )}
            </div>
            {!newPolicy ? (
              <div className="grid gap-2">
                {policies.map((p) => (
                  <Button
                    variant="outline"
                    type="button"
                    key={p.id}
                    onClick={() => setPolicy(p.id)}
                    className={cn(
                      "h-auto flex-col items-start whitespace-normal rounded-2xl border p-3 text-left transition",
                      policy === p.id && "border-sky bg-accent",
                    )}
                  >
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.requires_user_auth ? "Asks before debit" : "Fully automated"} ·{" "}
                      {p.max_retries} retries · emails {p.auto_email ? "on" : "off"}
                    </div>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border p-4">
                <Input
                  name="policy_name"
                  required
                  label="Policy name"
                  placeholder="High-value vendors"
                />
                <Toggle
                  label="Ask me before every debit"
                  checked={requireAuth}
                  onChange={setRequireAuth}
                />
                <Input
                  name="max_retries"
                  label="Max retry attempts"
                  type="number"
                  defaultValue={2}
                  min={0}
                  max={2}
                />
                <label className="block text-sm">Schedule &amp; Date
                  <select aria-label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3">
                    <option value="ONCE">Run Now / One-time</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option>
                  </select>
                </label>
                <div><span className="mb-2 block text-xs font-semibold text-muted-foreground">Start / Execution Date</span>
                  <Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-start"><CalendarDays />{executionDate ? format(executionDate, "PPP") : "Run now"}</Button></PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0 pointer-events-auto"><Calendar mode="single" selected={executionDate} onSelect={setExecutionDate} className="pointer-events-auto" /></PopoverContent>
                  </Popover>
                </div>
                <Input name="auto_approve_limit" label="Auto-Approve Limit (₹)" type="number" min={0} max={100000} step="0.01" placeholder="No limit" />
                <label className="block text-sm">Retry Delay
                  <select aria-label="Retry Delay" value={retryDelay} onChange={(e) => setRetryDelay(e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3"><option value="5">Instant / 5 sec</option><option value="900">15 mins</option><option value="3600">1 hour</option></select>
                </label>
                <Toggle
                  label="Email counterparty on failure / retry"
                  checked={autoEmail}
                  onChange={setAutoEmail}
                />
              </div>
            )}
          </section>
          <Button variant="brand" size="lg" className="w-full" type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Save Smart Transfer"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
