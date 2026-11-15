import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, Users, ShieldCheck, Square, ArrowUpRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TeammateBuilder } from "@/components/app/TeammateBuilder";
import { teamsOptions, useTeams, recordData } from "@/lib/teams";
import { manageTeammate } from "@/lib/teams.functions";
import { accountOptions } from "@/lib/account";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/_authenticated/teams/")({
  head: () =>
    seo(
      "Teams — payIQ",
      "Create and manage your private AI teammates, permissions and conversations.",
    ),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(accountOptions),
      context.queryClient.ensureQueryData(teamsOptions),
    ]);
  },
  component: Teams,
});
function Teams() {
  const { teams, records, draft, stopped } = useTeams();
  const [filter, setFilter] = useState("All");
  const [builder, setBuilder] = useState(false);
  const [stop, setStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const manage = useServerFn(manageTeammate);
  const qc = useQueryClient();
  const active = teams.filter((t) => t.status === "active").length;
  const visible = teams.filter(
    (t) =>
      t.status !== "retired" &&
      (filter === "All" ||
        (filter === "Active" && t.status === "active") ||
        (filter === "Paused" && t.status === "paused") ||
        (filter === "Needs setup" && ["configuring", "ready"].includes(t.status))),
  );
  return (
    <AppShell
      title="Teams"
      action={
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{active} active</span>
          <Button variant="destructive" size="sm" onClick={() => setStop(true)}>
            <Square className="size-4" />
            Stop all
          </Button>
        </div>
      }
    >
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div
          className="flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1"
          aria-label="Team filters"
        >
          {["All", "Active", "Needs setup", "Paused"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <Button variant="brand" onClick={() => setBuilder(true)}>
          <Plus />
          Create teammate
        </Button>
      </div>
      {stopped && (
        <p className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          All teammates stopped. Review setup and activate an individual teammate when you’re ready.
        </p>
      )}
      {draft && (
        <Button variant="outline" className="mb-5" onClick={() => setBuilder(true)}>
          <Sparkles />
          Resume teammate builder
        </Button>
      )}
      {visible.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((team) => {
            const runs = records.filter((r) => r.teammate_id === team.id && r.kind === "run");
            const today = runs.filter(
              (r) => new Date(r.created_at).toDateString() === new Date().toDateString(),
            ).length;
            const scopes = records.filter(
              (r) =>
                r.teammate_id === team.id &&
                r.kind === "scope" &&
                recordData(r)["revoked"] === false,
            );
            return (
              <Link
                key={team.id}
                to="/teams/$id"
                params={{ id: team.id }}
                className="group flex min-h-64 flex-col rounded-lg glass p-5 transition hover:border-sky/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-12 place-items-center rounded-full bg-accent font-display font-semibold text-accent-foreground">
                    {team.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs capitalize",
                      team.status === "active"
                        ? "bg-success/10 text-success"
                        : team.status === "paused"
                          ? "bg-secondary text-muted-foreground"
                          : "bg-warning/15 text-warning-foreground",
                    )}
                  >
                    {team.status === "configuring" ? "Needs setup" : team.status}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-semibold">{team.name}</h2>
                <p className="mt-1 text-xs capitalize text-muted-foreground">{team.role}</p>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{team.goal}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {scopes.length ? (
                    scopes.slice(0, 3).map((s) => (
                      <span key={s.id} className="text-xs text-accent-foreground">
                        {String(recordData(s)["scope"])}
                      </span>
                    ))
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="size-3" />
                      No access granted
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{runs.length ? `${today} runs today` : "No runs yet"}</span>
                  <ArrowUpRight className="size-4 text-accent-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center py-12 text-center">
          <div className="relative mb-6 flex items-end gap-3" aria-hidden="true">
            <Users className="size-10 text-muted-foreground" />
            <span className="grid size-20 place-items-center rounded-full bg-accent text-accent-foreground">
              <Bot className="size-10" />
            </span>
            <ShieldCheck className="size-10 text-success" />
          </div>
          <h2 className="text-xl font-semibold">
            {filter === "All" ? "Hire your first teammate" : "No teammates here"}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {filter === "All" ? "Describe the job and IQ will set it up." : "Try another filter."}
          </p>
          {filter === "All" && (
            <Button variant="outline" className="mt-5" onClick={() => setBuilder(true)}>
              <Plus />
              Create teammate
            </Button>
          )}
        </div>
      )}
      <TeammateBuilder open={builder} onClose={() => setBuilder(false)} />
      <Dialog open={stop} onOpenChange={setStop}>
        <DialogContent>
          <DialogTitle>Stop all teammates?</DialogTitle>
          <DialogDescription>
            All teammates pause and queued work is cancelled. No further tools can run.
          </DialogDescription>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await manage({ data: { action: "stop_all", values: {} } });
                  await qc.invalidateQueries({ queryKey: ["teams"] });
                  setStop(false);
                  toast.success("All teammates stopped");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not stop teammates.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Stop all
            </Button>
            <Button variant="outline" onClick={() => setStop(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
