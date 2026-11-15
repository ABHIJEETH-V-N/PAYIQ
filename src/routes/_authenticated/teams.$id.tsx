import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUp,
  Pause,
  Play,
  ShieldCheck,
  Upload,
  FileText,
  Download,
  Bot,
  UserRound,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { accountOptions, useAccount } from "@/lib/account";
import { teamsOptions, useTeams, recordData } from "@/lib/teams";
import { grantableScopes } from "@/lib/teams-validation";
import {
  manageTeammate,
  evaluateTeammate,
  messageTeammate,
  parseTeamDocument,
} from "@/lib/teams.functions";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
const tabs = [
  "Overview",
  "Conversation",
  "Permissions",
  "Connections",
  "Knowledge",
  "Policies",
  "Runs and audit",
  "Settings",
];
export const Route = createFileRoute("/_authenticated/teams/$id")({
  head: () =>
    seo(
      "Teammate — payIQ Teams",
      "Manage a private AI teammate’s conversation, permissions, knowledge and audit.",
    ),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(accountOptions),
      context.queryClient.ensureQueryData(teamsOptions),
    ]);
  },
  component: Teammate,
});
function Teammate() {
  const { id } = Route.useParams();
  const { teams, records, audit, stopped } = useTeams();
  const { policies } = useAccount();
  const team = teams.find((t) => t.id === id);
  const [tab, setTab] = useState("Overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [name, setName] = useState(team?.name ?? "");
  const [scope, setScope] = useState<(typeof grantableScopes)[number]>("read:transactions");
  const [purpose, setPurpose] = useState("");
  const [categories, setCategories] = useState("");
  const [cap, setCap] = useState("500");
  const [daily, setDaily] = useState("2000");
  const [policy, setPolicy] = useState(policies[0]?.id ?? "");
  const [auditFilter, setAuditFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const manage = useServerFn(manageTeammate);
  const evaluate = useServerFn(evaluateTeammate);
  const message = useServerFn(messageTeammate);
  const parse = useServerFn(parseTeamDocument);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["teams"] });
  async function task(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this change.");
    } finally {
      setBusy(false);
    }
  }
  type Action = Parameters<typeof manage>[0]["data"];
  const act = (action: Action["action"], values: Action["values"] = {}) =>
    task(() => manage({ data: { id, action, values } }));
  if (!team)
    return (
      <AppShell title="Teammate not found">
        <Link to="/teams" className="text-accent-foreground">
          Back to Teams
        </Link>
      </AppShell>
    );
  const own = records.filter((r) => r.teammate_id === id);
  const byKind = (kind: string) => own.filter((r) => r.kind === kind);
  const runs = byKind("run");
  const evaluation =
    team.evaluation && typeof team.evaluation === "object" && !Array.isArray(team.evaluation)
      ? team.evaluation
      : {};
  const checks = Array.isArray(evaluation["checks"]) ? evaluation["checks"] : [];
  const logs = audit.filter(
    (a) =>
      a.teammate_id === id &&
      a.action.includes(auditFilter) &&
      (!dateFrom || a.created_at.slice(0, 10) >= dateFrom) &&
      (!dateTo || a.created_at.slice(0, 10) <= dateTo),
  );
  const money = scope === "write:refund" || scope === "write:reversal";
  return (
    <AppShell
      title={team.name}
      action={
        <div className="flex items-center gap-3">
          <span className="text-xs capitalize text-muted-foreground">{team.status}</span>
          <Button
            variant="outline"
            disabled={busy || team.status === "retired"}
            onClick={() => void act(team.status === "active" ? "pause" : "activate")}
          >
            {team.status === "active" ? <Pause /> : <Play />}
            {team.status === "active" ? "Pause" : "Activate"}
          </Button>
        </div>
      }
    >
      <Link
        to="/teams"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        Teams
      </Link>
      <nav
        aria-label="Teammate tabs"
        className="mb-7 flex gap-1 overflow-x-auto border-b pb-2 scrollbar-none"
      >
        {tabs.map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "ghost"}
            size="sm"
            className="shrink-0"
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </nav>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Working…
        </p>
      )}
      {tab === "Overview" && (
        <div className="space-y-7">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
              <Bot />
            </span>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{team.role} · AI teammate</p>
              <h2 className="mt-2 text-lg font-semibold">{team.goal}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {stopped ? "Owner stop switch is on" : "Human-controlled permissions"} · Simulated
                funds only
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x border-y py-5">
            {[
              [
                "Runs this week",
                runs.filter((r) => Date.parse(r.created_at) > Date.now() - 7 * 86400000).length,
              ],
              ["Escalations", byKind("handoff").length],
              [
                "Permissions",
                byKind("scope").filter((r) => recordData(r)["revoked"] === false).length,
              ],
            ].map(([label, count]) => (
              <div className="px-3" key={label}>
                <p className="text-2xl font-semibold">{count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-5 text-success" />
                Activation checks
              </h2>
              <Button
                variant="outline"
                disabled={busy || team.status === "retired"}
                onClick={() => void task(() => evaluate({ data: id }))}
              >
                Run evaluation
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Published policies, current permissions, required knowledge and a passed evaluation
              are needed.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {checks.map((c, i) => {
                const v = c && typeof c === "object" && !Array.isArray(c) ? c : {};
                return (
                  <li key={i} className="flex justify-between border-b py-2">
                    <span>{String(v["name"] ?? "Check")}</span>
                    <span className={v["passed"] ? "text-success" : "text-destructive"}>
                      {v["passed"] ? "Passed" : "Failed"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {checks.length
                ? "Model: Groq GPT OSS 120B · Evaluation covers read-only and chat safety."
                : "No evaluation run yet."}
            </p>
          </section>
          {byKind("handoff").length > 0 && (
            <section>
              <h2 className="font-semibold">Handoffs</h2>
              {byKind("handoff").map((r) => (
                <div key={r.id} className="mt-3 border-l-2 border-sky pl-4">
                  <p className="text-sm">
                    {recordData(r)["to"] === "iq" ? "Asked IQ for help" : "Human help requested"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {String(recordData(r)["message"] ?? "Pending owner review")}
                  </p>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
      {tab === "Conversation" && (
        <div className="mx-auto max-w-3xl space-y-4 pb-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">AI teammate · Private conversation</p>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act("ask_human")}>
              <UserRound />
              Ask a human
            </Button>
          </div>
          {byKind("message").length === 0 && (
            <div className="py-12 text-center">
              <Bot className="mx-auto size-10 text-sky" />
              <p className="mt-4 font-semibold">Start a conversation with {team.name}</p>
            </div>
          )}
          {byKind("message").map((r) => {
            const d = recordData(r);
            return (
              <div
                key={r.id}
                className={cn("flex", d["role"] === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-3",
                    d["role"] === "user" ? "bg-secondary" : "glass",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {String(d["text"] ?? "")}
                  </p>
                  {d["role"] !== "user" && (
                    <p className="mt-2 text-[10px] text-muted-foreground">AI teammate</p>
                  )}
                </div>
              </div>
            );
          })}
          <form
            className="sticky bottom-28 flex items-end gap-2 rounded-lg glass p-3 lg:bottom-5"
            onSubmit={(e) => {
              e.preventDefault();
              void task(async () => {
                await message({ data: { id, text: input } });
                setInput("");
              });
            }}
          >
            <textarea
              aria-label="Teammate message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={10000}
              rows={2}
              disabled={busy || team.status !== "active" || stopped}
              placeholder={
                team.status === "active" ? `Ask ${team.name}…` : "Activate this teammate to start"
              }
              className="min-w-0 flex-1 resize-none bg-transparent p-2 text-sm outline-none"
            />
            <Button
              aria-label="Send teammate message"
              title="Send message"
              variant="brand"
              size="icon"
              disabled={busy || !input.trim() || team.status !== "active" || stopped}
            >
              <ArrowUp />
            </Button>
          </form>
        </div>
      )}
      {tab === "Permissions" && (
        <div className="space-y-6">
          <h2 className="font-semibold">Human-granted permissions</h2>
          <div className="divide-y">
            {byKind("scope").map((r) => {
              const d = recordData(r);
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-semibold">{String(d["scope"])}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(d["purpose"])} ·{" "}
                      {d["revoked"]
                        ? "Revoked"
                        : `Expires ${new Date(String(d["expires_at"])).toLocaleDateString()}`}
                    </p>
                    {Boolean(d["limit_per_action_paise"]) && (
                      <p className="mt-1 text-xs">
                        ₹{Number(d["limit_per_action_paise"]) / 100} per action · ₹
                        {Number(d["daily_cap_paise"]) / 100} daily
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void act("renew", { record_id: r.id })}
                    >
                      Renew
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy || d["revoked"] === true}
                      onClick={() => void act("revoke", { record_id: r.id })}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <form
            className="max-w-xl space-y-4 border-t pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void act("grant", {
                grant: {
                  scope,
                  purpose,
                  categories,
                  limit_per_action_paise: money ? Math.round(Number(cap) * 100) : null,
                  daily_cap_paise: money ? Math.round(Number(daily) * 100) : null,
                  approval: money ? "always" : "none",
                },
              });
            }}
          >
            <label className="block text-sm">
              Scope
              <select
                className="mt-1 h-11 w-full rounded-lg border bg-background px-3"
                value={scope}
                onChange={(e) => {
                  const v = grantableScopes.find((s) => s === e.target.value);
                  if (v) setScope(v);
                }}
              >
                {grantableScopes.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Purpose
              <input
                required
                maxLength={500}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border bg-background px-3"
              />
            </label>
            <label className="block text-sm">
              Data categories
              <input
                required
                maxLength={300}
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="For example: transaction amounts and status"
                className="mt-1 h-11 w-full rounded-lg border bg-background px-3"
              />
            </label>
            {money && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Per-action cap (₹)
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      required
                      value={cap}
                      onChange={(e) => setCap(e.target.value)}
                      className="mt-1 h-11 w-full rounded-lg border bg-background px-3"
                    />
                  </label>
                  <label className="text-sm">
                    Daily cap (₹)
                    <input
                      type="number"
                      min="1"
                      max="10000000"
                      required
                      value={daily}
                      onChange={(e) => setDaily(e.target.value)}
                      className="mt-1 h-11 w-full rounded-lg border bg-background px-3"
                    />
                  </label>
                </div>
                <p className="text-sm text-warning-foreground">
                  Money execution is unavailable. These reviewed limits do not authorise refunds or
                  reversals yet.
                </p>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Expires after 90 days. Grants invalidate the previous evaluation.
            </p>
            <Button variant="brand" disabled={busy}>
              Grant permission
            </Button>
          </form>
        </div>
      )}
      {tab === "Connections" && (
        <section className="space-y-5">
          <h2 className="font-semibold">Connections</h2>
          <div className="flex items-start gap-3 border-l-2 border-warning pl-4">
            <Link2 className="mt-1 size-5 shrink-0 text-warning-foreground" />
            <div>
              <p className="text-sm font-medium">Secure connection setup is unavailable</p>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                The credential vault and safe endpoint verification have not been confirmed.
                Connection strings, API keys and tokens cannot be entered or tested here yet.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Read-only database", "REST API", "Outbound webhook", "MCP server"].map((label) => (
              <div className="rounded-lg border p-4" key={label}>
                <h3 className="text-sm font-semibold">{label}</h3>
                <p className="mt-2 text-xs text-muted-foreground">Not connected</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {tab === "Knowledge" && (
        <section>
          <h2 className="font-semibold">Required knowledge</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            PDF, TXT, CSV or XLSX · Up to 10 MB · Personal identifiers and credentials are rejected.
          </p>
          <div className="mt-5 divide-y">
            {byKind("document").map((r) => {
              const d = recordData(r);
              return (
                <div className="py-5" key={r.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="size-5 text-sky" />
                      <h3 className="text-sm font-semibold">{String(d["name"])}</h3>
                    </div>
                    <span className="text-xs capitalize text-muted-foreground">
                      {String(d["status"])} · {d["required"] ? "Required" : "Optional"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{String(d["purpose"])}</p>
                  {Boolean(d["reject_reason"]) && (
                    <p className="mt-2 text-sm text-destructive">{String(d["reject_reason"])}</p>
                  )}
                  <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                    <Upload className="size-4" />
                    {d["status"] === "parsed" ? "Replace document" : "Upload document"}
                    <input
                      type="file"
                      accept=".pdf,.txt,.csv,.xlsx"
                      disabled={busy}
                      className="sr-only"
                      aria-label={`Upload ${String(d["name"])}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void task(async () => {
                          const form = new FormData();
                          form.set("file", file);
                          form.set("id", id);
                          form.set("record_id", r.id);
                          await parse({ data: form });
                          toast.success("Document parsed");
                        });
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {Boolean(d["parsed_summary"]) && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer text-accent-foreground">
                        Parsed summary
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(d["parsed_summary"], null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {tab === "Policies" && (
        <section className="space-y-5">
          <h2 className="font-semibold">Attached policies</h2>
          <div className="divide-y">
            {byKind("policy").map((r) => {
              const d = recordData(r);
              const p = policies.find((p) => p.id === d["policy_id"]);
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <h3 className="text-sm font-semibold">{p?.name ?? "Unavailable policy"}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d["published"] ? "Published for teammate" : "Attached draft"} · Up to{" "}
                      {p?.max_retries ?? 0} retries
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || d["published"] === true}
                      onClick={() => void act("publish_policy", { record_id: r.id })}
                    >
                      Publish
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void act("detach_policy", { record_id: r.id })}
                    >
                      Detach
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex max-w-xl gap-2">
            <select
              aria-label="Policy to attach"
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3"
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button
              variant="brand"
              disabled={busy || !policy}
              onClick={() => void act("attach_policy", { policy_id: policy })}
            >
              Attach
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Attaching or publishing a policy requires a new teammate evaluation. Wallet policies
            never enable teammate money execution.
          </p>
        </section>
      )}
      {tab === "Runs and audit" && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Runs and immutable audit</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const content = JSON.stringify(logs, null, 2);
                const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = "payiq-teammate-audit.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download />
              Export audit
            </Button>
          </div>
          {runs.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
            >
              <div>
                <p className="text-sm capitalize">
                  {String(recordData(r)["status"])} · {String(recordData(r)["outcome"] ?? "")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void act("report", { run_id: r.id, message: "Please review this teammate run." })
                }
              >
                <AlertTriangle />
                Report a problem
              </Button>
            </div>
          ))}
          {byKind("approval").map((r) => (
            <p key={r.id} className="border-l-2 border-warning pl-3 text-sm">
              Blocked: {String(recordData(r)["check"])}. No executable money approval is available.
            </p>
          ))}
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              aria-label="Filter audit action"
              placeholder="Filter action…"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="h-11 rounded-lg border bg-background px-3"
            />
            <input
              aria-label="Audit from date"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-11 rounded-lg border bg-background px-3"
            />
            <input
              aria-label="Audit to date"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-11 rounded-lg border bg-background px-3"
            />
          </div>
          <div className="divide-y">
            {logs.map((a) => (
              <div key={a.id} className="flex justify-between gap-3 py-3 text-sm">
                <div>
                  <p>{a.action}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{a.outcome}</span>
              </div>
            ))}
          </div>
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground">No matching audit entries.</p>
          )}
        </section>
      )}
      {tab === "Settings" && (
        <section className="max-w-xl space-y-6">
          <label className="block text-sm">
            Teammate name
            <input
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border bg-background px-3"
            />
          </label>
          <Button
            variant="outline"
            disabled={busy || !name.trim()}
            onClick={() => void act("rename", { name })}
          >
            Save name
          </Button>
          <div className="border-t pt-5">
            <h2 className="font-semibold">Ownership</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ownership transfer is unavailable until a verified invitation and checker workflow is
              configured.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 border-t pt-5">
            <Button
              variant="outline"
              disabled={busy || team.status === "retired"}
              onClick={() => void act("pause")}
            >
              <Pause />
              Pause
            </Button>
            {team.status === "retired" ? (
              <Button variant="outline" disabled={busy} onClick={() => void act("restore")}>
                Restore teammate
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Retire this teammate? It can be restored for 30 days."))
                    void act("retire");
                }}
              >
                Retire teammate
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Retired teammates can be restored within 30 days. Audit history is retained.
          </p>
        </section>
      )}
    </AppShell>
  );
}
