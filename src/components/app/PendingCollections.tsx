import { friendlyEmailError } from "@/lib/email-notice";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account";
import { confirmTransfer, cancelTransfer } from "@/lib/finance.functions";
import { inr } from "@/lib/mock";
import { reminderLabel } from "@/lib/smart-transfer-model";

export function PendingCollections() {
  const account = useAccount();
  const qc = useQueryClient();
  const confirm = useServerFn(confirmTransfer);
  const cancel = useServerFn(cancelTransfer);
  const [busy, setBusy] = useState<string | null>(null);
  async function respond(id: string, accept: boolean) {
    setBusy(id);
    try {
      if (accept) {
        const result = await confirm({ data: id });
        if (result.error) throw new Error(result.error);
        toast.success("Transfer completed");
        if (result.notification.status === "FAILED") toast.warning(friendlyEmailError(result.notification.error));
      } else { await cancel({ data: id }); toast.success("Request declined"); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not respond"); }
    finally { await qc.invalidateQueries({ queryKey: ["account"] }); await qc.invalidateQueries({ queryKey: ["incoming-notifications"] }); setBusy(null); }
  }
  if (!account.pendingCollections.length) return null;
  return <section className="mb-6 border-b pb-6">
    <h2 className="mb-3 text-lg font-semibold">Pending Requests</h2>
    <div className="grid gap-3 md:grid-cols-2">
      {account.pendingCollections.map((r) => <article key={r.id} className="rounded-lg border bg-background/70 p-4">
        <span className="text-xs font-semibold text-success">COLLECTABLE</span>
        <h3 className="mt-2 font-semibold">{r.sender_name} requested {inr(r.amount)}</h3>
        <p className="mt-1 break-words text-sm text-muted-foreground">{r.name} · Cap: {r.max_cap === null ? "No cap" : inr(r.max_cap)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Awaiting your approval · {reminderLabel(r.reminder_cadence)}</p>
        <p className="mt-2 text-xs text-muted-foreground">Simulated funds · deducted from your Wallet on acceptance</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="brand" size="sm" disabled={!!busy} onClick={() => void respond(r.id, true)}>Accept &amp; Pay</Button>
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void respond(r.id, false)}>Decline</Button>
        </div>
      </article>)}
    </div>
  </section>;
}