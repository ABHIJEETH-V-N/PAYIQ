import { friendlyEmailError } from "@/lib/email-notice";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/account";
import { incomingNotifications, markNotificationRead } from "@/lib/incoming.functions";
import { confirmTransfer, cancelTransfer } from "@/lib/finance.functions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function NotificationsBell() {
  const account = useAccount();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const read = useServerFn(markNotificationRead);
  const confirm = useServerFn(confirmTransfer);
  const cancel = useServerFn(cancelTransfer);
  const options = queryOptions({ queryKey: ["incoming-notifications", account.profile.id], queryFn: () => incomingNotifications(), refetchInterval: 30000 });
  const { data = [], error } = useQuery(options);
  useEffect(() => {
    const channel = supabase.channel(`notifications-${account.profile.id}-${crypto.randomUUID()}`).on("postgres_changes", {
      event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${account.profile.id}`,
    }, () => { void qc.invalidateQueries({ queryKey: ["incoming-notifications"] }); void qc.invalidateQueries({ queryKey: ["account"] }); }).on("postgres_changes", {
      event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${account.profile.id}`,
    }, () => { void qc.invalidateQueries({ queryKey: ["account"] }); }).on("postgres_changes", {
      event: "*", schema: "public", table: "sync_requests", filter: `user_id=eq.${account.profile.id}`,
    }, () => { void qc.invalidateQueries({ queryKey: ["account"] }); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [account.profile.id, qc]);
  const unread = data.filter((n) => !n.is_read).length;
  return <>
    <Button aria-label="Notifications" title="Notifications" variant="ghost" size="icon" className="relative size-10 rounded-full glass" onClick={() => setOpen(true)}>
      <Bell className="size-4" />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 h-5 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
    </Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>Notifications</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-1 pb-8">
          {error && <p role="alert" className="text-sm text-destructive">Could not load notifications.</p>}
          {!error && !data.length && <p className="text-sm text-muted-foreground">No incoming updates yet.</p>}
          {data.map((n) => {
            const transfer = account.transfers.find((t) => t.id === n.related_id);
            const canPay = transfer?.payer_id === account.profile.id && transfer.status === "AWAITING_USER_AUTH";
            return <article key={n.id} className="border-b py-4">
              <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{n.title}</h3>{!n.is_read && <span className="mt-2 size-2 shrink-0 rounded-full bg-sky" />}</div>
              <p className="mt-1 break-words text-sm text-muted-foreground">{n.message}</p>
              <time className="mt-2 block text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</time>
              <div className="mt-3 flex flex-wrap gap-2">
                {canPay && <Button variant="brand" size="sm" disabled={!!busy} onClick={async () => {
                  if (!n.related_id) return;
                  setBusy(n.id);
                  try { const result = await confirm({ data: n.related_id }); if (result.error) throw new Error(result.error); await read({ data: n.id }); await qc.invalidateQueries({ queryKey: ["account"] }); await qc.invalidateQueries({ queryKey: ["incoming-notifications"] }); toast.success("Transfer completed"); if (result.notification.status === "FAILED") toast.warning(friendlyEmailError(result.notification.error)); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "Could not pay"); } finally { setBusy(null); }
                }}>Accept &amp; Pay</Button>}
                {canPay && <Button variant="outline" size="sm" disabled={!!busy} onClick={async () => {
                  if (!n.related_id) return; setBusy(n.id);
                  try { await cancel({ data: n.related_id }); await read({ data: n.id }); await qc.invalidateQueries({ queryKey: ["account"] }); await qc.invalidateQueries({ queryKey: ["incoming-notifications"] }); toast.success("Request declined"); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "Could not decline"); } finally { setBusy(null); }
                }}>Decline</Button>}
                {!canPay && <Button variant="outline" size="sm" asChild><Link to="/ledger" onClick={() => setOpen(false)}><ArrowUpRight />View in Ledger</Link></Button>}
                {!n.is_read && <Button variant="ghost" size="icon" aria-label="Mark as read" title="Mark as read" onClick={async () => { try { await read({ data: n.id }); await qc.invalidateQueries({ queryKey: ["incoming-notifications"] }); } catch { toast.error("Could not mark as read"); } }}><Check /></Button>}
              </div>
            </article>;
          })}
        </div>
      </SheetContent>
    </Sheet>
  </>;
}