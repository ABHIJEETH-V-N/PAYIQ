import { useEffect, useState } from "react";
import { Printer, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { exportReceipt, type Receipt } from "@/lib/merchant-receipt";
import { downloadFinanceExport } from "@/lib/finance-export";
import { inr } from "@/lib/mock";

export function MerchantReceipt({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  const [files,setFiles]=useState<Awaited<ReturnType<typeof exportReceipt>>[]>([]);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;setFiles([]);setError("");
    if(receipt)void Promise.all([exportReceipt(receipt,"PDF"),exportReceipt(receipt,"CSV")]).then((result)=>{if(active)setFiles(result);}).catch(()=>{if(active)setError("Could not generate your receipt.");});
    return ()=>{active=false;};
  },[receipt]);
  return <Sheet open={!!receipt} onOpenChange={(open)=>{if(!open)onClose();}}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-3xl print:static print:max-w-none print:overflow-visible" aria-describedby={undefined}>
      <SheetHeader><SheetTitle>{receipt?.rows.length===1?"Payment receipt":"User statement"}</SheetTitle></SheetHeader>
      {receipt && <>
        <div className="my-5 flex flex-wrap gap-2 print:hidden">
          <Button variant="brand" disabled={!files[0]} onClick={()=>{const file=files[0];if(file)downloadFinanceExport(file);}}><Download />Download PDF</Button>
          <Button variant="outline" disabled={!files[1]} onClick={()=>{const file=files[1];if(file)downloadFinanceExport(file);}}><FileText />Download CSV</Button>
          <Button variant="outline" onClick={()=>{toast.info("Choose Save as PDF or your printer in the print dialog.");window.print();}}><Printer />Print</Button>
        </div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <article className="receipt-print space-y-5">
          <header className="border-b pb-4"><h2 className="text-2xl font-bold text-primary">pay<span className="text-sky">IQ</span>™</h2><h3 className="mt-3 font-semibold">{receipt.merchant.name}</h3><p className="break-words text-sm text-muted-foreground">{receipt.merchant.email} · {receipt.merchant.phone || "Phone not provided"}</p><p className="break-all text-sm">UPI: {receipt.merchant.upi_id || "Not provided"}<br/>Merchant ID: {receipt.merchant.id}</p></header>
          <div className="grid gap-4 sm:grid-cols-2"><div><h3 className="text-xs font-semibold text-muted-foreground">BILLED TO / COUNTERPARTY</h3><p className="break-words font-semibold">{receipt.party}</p>{receipt.rows.slice(0,1).map((r)=><p key={r.id} className="break-all text-sm text-muted-foreground">{r.direction==="DEBIT"?r.to_upi:r.from_upi}<br/>{r.direction==="DEBIT"?r.to_email:r.from_email}</p>)}</div><div className="text-sm"><p>{receipt.number}</p><p>{new Date(receipt.date).toLocaleString()}</p><p className="text-muted-foreground">payIQ Wallet · Simulated funds</p></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead><tr className="border-b"><th className="py-3">Date / Order ID</th><th>Description</th><th>Direction</th><th>Status</th><th className="text-right">Amount (₹)</th></tr></thead><tbody>{receipt.rows.map((r)=><tr key={r.id} className="border-b"><td className="py-3 pr-2">{new Date(r.created_at).toLocaleDateString()}<br/><span className="break-all text-muted-foreground">{r.order_id}</span></td><td className="max-w-40 break-words pr-2">{r.description || "Payment"}</td><td>{r.direction}</td><td>{r.status}</td><td className="text-right">{inr(r.amount)}</td></tr>)}</tbody></table></div>
          <dl className="ml-auto max-w-xs space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>Subtotal (all attempts)</dt><dd>{inr(receipt.subtotal)}</dd></div><div className="flex justify-between gap-3 border-t pt-2 font-semibold"><dt>Total settled amount</dt><dd>{inr(receipt.total)}</dd></div></dl>
          <p className="border-t pt-4 text-xs text-muted-foreground">Payment receipt / statement — not a tax invoice. Failed and pending attempts are excluded from the settled total. Simulated funds; Paytm Gateway disconnected. No GST certification.</p>
        </article>
      </>}
    </SheetContent>
  </Sheet>;
}