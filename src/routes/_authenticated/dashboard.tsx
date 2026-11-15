import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip, Cell, Pie, PieChart } from "recharts";
import { ArrowUpRight, Bot, Hand, IndianRupee, Users } from "lucide-react";
import { AppShell, Panel } from "@/components/app/AppShell";
import { inr } from "@/lib/mock";
import { accountOptions, useAccount } from "@/lib/account";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { dashboardMetrics } from "@/lib/smart-transfer-model";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () =>
    seo("Dashboard — payIQ", "Today's volume, automated actions and items that need you."),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountOptions),
  component: Dashboard,
});

function Dashboard() {
  const account = useAccount();
  const d = {
    ...dashboardMetrics(account.transactions, account.transfers, account.syncs),
    recent_activity: account.transactions.slice(0, 5).map((t) => ({
      id: t.id,
      action: t.status,
      party: t.to_party,
      amount: Number(t.amount),
      is_automated: t.is_automated,
      note: t.order_id,
      time: new Date(t.created_at).toLocaleString(),
    })),
  };
  const split = [
    { name: "Automated", v: d.automated_count },
    { name: "Manual", v: d.manual_count },
  ];
  return (
    <AppShell title="Good evening 👋" subtitle="Here's what your AI teammate handled today.">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl bg-brand p-5 text-primary-foreground shadow-brand animate-rise md:col-span-1">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-sky/40 blur-2xl" />
          <div className="relative flex items-center gap-2 text-sm text-primary-foreground/80">
            <IndianRupee className="size-4" /> Volume today
          </div>
          <div className="relative mt-3 font-display text-4xl font-bold">{inr(d.today_volume)}</div>
          <div className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs">
            <ArrowUpRight className="size-3" /> Confirmed payments
          </div>
        </div>
        <Stat
          icon={Bot}
          label="Done automatically"
          value={String(d.automated_count)}
          hint={`${d.automation_rate}% of all actions`}
          tone="sky"
        />
        <Stat
          icon={Hand}
          label="Needs your attention"
          value={String(d.attention_count)}
          hint="Failed after 2 retries or awaiting approval"
          tone="warn"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Automation split</h2>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <Legend c="bg-sky" l="Automated" />
              <Legend c="bg-navy" l="Manual" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[120px_1fr] items-center gap-4 sm:grid-cols-[150px_1fr]">
            <div className="relative h-[120px] sm:h-[150px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={split}
                    dataKey="v"
                    innerRadius="70%"
                    outerRadius="100%"
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="var(--sky)" />
                    <Cell fill="var(--navy)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="font-display text-xl font-bold">{d.automation_rate}%</div>
                  <div className="text-[10px] text-muted-foreground">automated</div>
                </div>
              </div>
            </div>
            <div className="h-[150px]">
              <ResponsiveContainer>
                <BarChart data={d.hourly} barGap={2}>
                  <XAxis
                    dataKey="h"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }}
                  />
                  <Bar dataKey="auto" stackId="a" fill="var(--sky)" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="manual" stackId="a" fill="var(--navy)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Live activity</h2>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-sky animate-pulse-dot" /> Payment connection
              pending
            </span>
          </div>
          <ul className="mt-4 space-y-1">
            {d.recent_activity.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-2xl p-2 transition hover:bg-secondary"
              >
                <div
                  className={cn(
                    "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
                    a.is_automated
                      ? "bg-accent text-accent-foreground"
                      : "bg-warning/20 text-warning-foreground",
                  )}
                >
                  {a.is_automated ? <Bot className="size-4" /> : <Hand className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {a.action} · {a.party}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.note} · {a.time}
                  </div>
                </div>
                <div className="text-sm font-semibold">{inr(a.amount)}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Link to="/teams" className="mt-5 flex items-center gap-4 rounded-lg glass p-5">
        <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground">
          <Users />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold">Teams</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your AI teammates</p>
        </div>
        <ArrowUpRight className="size-5 text-accent-foreground" />
      </Link>
    </AppShell>
  );
}

function Legend({ c, l }: { c: string; l: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", c)} />
      {l}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  hint: string;
  tone: "sky" | "warn";
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div
          className={cn(
            "grid size-9 place-items-center rounded-full",
            tone === "sky"
              ? "bg-accent text-accent-foreground"
              : "bg-warning/20 text-warning-foreground",
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3 font-display text-4xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </Panel>
  );
}
