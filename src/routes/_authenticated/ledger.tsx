import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useWebMCP } from "use-webmcp-tool";
import { ChevronDown, FileText, Search, SlidersHorizontal, Download, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { StatusPill } from "@/components/app/StatusPill";
import { MerchantReceipt } from "@/components/app/MerchantReceipt";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { accountOptions, useAccount } from "@/lib/account";
import { getPartyStatement } from "@/lib/ledger.functions";
import { filterLedger, parseAudit, settledTotal, type LedgerRow } from "@/lib/ledger-model";
import { buildReceipt, type Receipt } from "@/lib/merchant-receipt";
import { createFinanceExport, downloadFinanceExport } from "@/lib/finance-export";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";
import { inr } from "@/lib/mock";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ledger")({
  head: () => seo("Ledger & merchant receipts — payIQ", "Review wallet and Smart Transfer records, audit trails and merchant payment statements."),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountOptions),
  component: LedgerPage,
});
function Chips<T extends string>({value,onChange,options}:{value:T;onChange:(v:T)=>void;options:[T,string][]}) {
  return <div className="flex flex-wrap gap-1">{options.map(([v,label])=><Button key={v} size="sm" variant={value===v?"default":"outline"} className="h-8 rounded-full px-3 text-xs" onClick={()=>onChange(v)}>{label}</Button>)}</div>;
}
function LedgerPage(){
  const account=useAccount();
  const statement=useServerFn(getPartyStatement);
  const [q,setQ]=useState("");
  const [status,setStatus]=useState("ALL");
  const [direction,setDirection]=useState("ALL");
  const [source,setSource]=useState("ALL");
  const [from,setFrom]=useState("");const [to,setTo]=useState("");
  const [min,setMin]=useState("");const [max,setMax]=useState("");
  const [more,setMore]=useState(false);const [open,setOpen]=useState<string|null>(null);
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const [partyOpen,setPartyOpen]=useState(false);const [party,setParty]=useState("");const [busy,setBusy]=useState(false);
  const rows:LedgerRow[]=account.transactions.map((t)=>({...t,amount:Number(t.amount),audit_trail:parseAudit(t.audit_trail)}));
  const list=filterLedger(rows,{party:q,status,direction,source,from,to,min,max});
  const parties=[...new Set(rows.flatMap((r)=>[r.direction==="DEBIT"?r.to_email||r.to_upi||r.to_party:r.from_email||r.from_upi||r.from_party]).filter(Boolean))];
  useWebMCP({name:"read_visible_ledger",description:"Read transactions visible under current ledger filters.",annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>runWebMCPTool("read_visible_ledger",()=>list.slice(0,20).map((t)=>`${t.id}: ${t.from_party} to ${t.to_party}, ${inr(t.amount)}, ${t.status}`).join("\n")||"No visible transactions.")});
  function single(row:LedgerRow){setReceipt(buildReceipt(account.profile,[row],row.direction==="DEBIT"?row.to_party:row.from_party));}
  async function consolidated(){
    setBusy(true);
    try{const all=await statement({data:{party}});setReceipt(buildReceipt(account.profile,all.map((t)=>({...t,amount:Number(t.amount),audit_trail:parseAudit(t.audit_trail)})),party));setPartyOpen(false);}
    catch(e){toast.error(e instanceof Error?e.message:"Could not create statement");}finally{setBusy(false);}
  }
  return <AppShell title="Ledger" subtitle="Wallet and Smart Transfers · transaction history">
    <section className="space-y-4 border-b pb-5">
      <div className="flex gap-2"><label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border bg-background px-3"><Search className="size-4 shrink-0 text-muted-foreground"/><input aria-label="Search party" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="From / To · name, UPI or email" value={q} onChange={(e)=>setQ(e.target.value)}/></label><Button aria-label="More filters" title="More filters" variant={more?"default":"outline"} size="icon" className="size-11" onClick={()=>setMore(!more)}><SlidersHorizontal/></Button></div>
      <div className="flex flex-wrap gap-3"><Chips value={status} onChange={setStatus} options={[["ALL","All statuses"],["SUCCESS","Success"],["RETRYING","Retrying"],["FAILED","Failed"]]}/><Chips value={direction} onChange={setDirection} options={[["ALL","Both directions"],["DEBIT","Debit"],["CREDIT","Credit"]]}/><Chips value={source} onChange={setSource} options={[["ALL","All sources"],["SYNC_REQUEST","Smart Transfer"],["WALLET_TRANSFER","Wallet Transfer"]]}/></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-muted-foreground">From date<input aria-label="From date" type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground"/></label><label className="text-xs font-semibold text-muted-foreground">To date<input aria-label="To date" type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground"/></label></div>
      {from&&to&&from>to&&<p role="alert" className="text-sm text-destructive">End date must be on or after start date.</p>}
      {more&&<div className="grid grid-cols-2 gap-3"><label className="text-xs">Min amount (₹)<input type="number" min="0" value={min} onChange={(e)=>setMin(e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3"/></label><label className="text-xs">Max amount (₹)<input type="number" min="0" value={max} onChange={(e)=>setMax(e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3"/></label></div>}
    </section>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground"><strong className="text-foreground">{list.length}</strong> records · <strong className="text-foreground">{inr(settledTotal(list))}</strong> settled</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!list.length} onClick={()=>{void createFinanceExport(list,"CSV").then(downloadFinanceExport).catch(()=>toast.error("Export failed"));}}><Download/>CSV</Button><Button size="sm" variant="brand" onClick={()=>{setParty(q);setPartyOpen(true);}}><Users/>Generate User Statement / Invoice</Button></div></div>
    <div className="divide-y border-y">{!list.length&&<p className="py-10 text-center text-sm text-muted-foreground">No transactions match these filters.</p>}{list.map((t)=><article key={t.id} className="py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{t.from_party||"Account"} → {t.to_party||"Account"}</p><p className="mt-1 break-all text-xs text-muted-foreground">{t.from_upi||t.from_email||"—"} → {t.to_upi||t.to_email||"—"}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</p></div><div className="text-right"><p className={cn("font-display text-lg font-bold",t.direction==="CREDIT"&&"text-success")}>{t.direction==="CREDIT"?"+":"−"}{inr(t.amount)}</p><span className="mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold">{t.direction}</span></div></div>
      <div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded border px-2 py-1 text-xs">{t.source_type==="SYNC_REQUEST"?"Smart Transfer":"Wallet Transfer"}</span><StatusPill status={t.status}/>{t.is_simulated&&<span className="text-xs text-muted-foreground">Simulated</span>}<span className="ml-auto flex gap-1"><Button size="sm" variant="outline" onClick={()=>single(t)}><FileText/>Invoice</Button><Button size="icon" variant="ghost" title="Execution & Retry Audit Trail" aria-label={`Audit trail ${t.order_id}`} onClick={()=>setOpen(open===t.id?null:t.id)}><ChevronDown className={cn(open===t.id&&"rotate-180")}/></Button></span></div>
      {t.status==="FAILED"&&<p className="mt-3 break-words text-sm text-destructive">Failed: {t.bank_error||"Unknown failure"}{t.retry_count>0?` after ${t.retry_count} retries`:""}</p>}
      {open===t.id&&<div className="mt-4 border-l-2 border-sky pl-4"><h3 className="mb-3 text-sm font-semibold">Execution &amp; Retry Audit Trail</h3><p className="mb-3 break-all text-xs text-muted-foreground">Order: {t.order_id}</p><ol className="space-y-3">{t.audit_trail.map((a,i)=><li key={i} className="text-sm"><p className="break-words">{a.e}</p><time className="text-xs text-muted-foreground">{new Date(a.t).toLocaleString()}</time></li>)}</ol>{!t.audit_trail.length&&<p className="text-xs text-muted-foreground">No recorded execution events.</p>}</div>}
    </article>)}</div>
    <Sheet open={partyOpen} onOpenChange={setPartyOpen}><SheetContent className="w-full sm:max-w-md"><SheetHeader><SheetTitle>All payments to / from a user</SheetTitle></SheetHeader><label className="mt-6 block text-sm">Counterparty<input aria-label="Statement counterparty" list="statement-parties" value={party} onChange={(e)=>setParty(e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3"/><datalist id="statement-parties">{parties.map((p)=><option key={p} value={p}/>)}</datalist></label><Button className="mt-4 w-full" variant="brand" disabled={busy||!party.trim()} onClick={()=>void consolidated()}>{busy?"Preparing…":"Generate complete statement"}</Button></SheetContent></Sheet>
    <MerchantReceipt receipt={receipt} onClose={()=>setReceipt(null)}/>
  </AppShell>;
}
