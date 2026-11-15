import { csvCell } from "./finance-export";
import { settledTotal, type LedgerRow } from "./ledger-model";
export type Merchant = { id: string; name: string; email: string; phone: string; upi_id: string };
export type Receipt = { number: string; date: string; merchant: Merchant; rows: LedgerRow[]; party: string; total: number; subtotal: number };
export function buildReceipt(merchant: Merchant, rows: LedgerRow[], party: string): Receipt {
  if (!rows.length) throw new Error("No matching transactions to include.");
  return { number: `INV-${Date.now()}-${rows[0]?.id.slice(0,8) ?? "PAYIQ"}`, date: new Date().toISOString(), merchant, rows, party,
    total: settledTotal(rows), subtotal: rows.reduce((sum,r) => sum+r.amount,0) };
}
export async function exportReceipt(receipt: Receipt, format: "PDF" | "CSV") {
  const { merchant: m } = receipt;
  const metadata = [
    ["payIQ™", receipt.rows.length === 1 ? "Payment receipt — not a tax invoice" : "Counterparty statement — not a tax invoice"],
    ["Merchant",m.name],["Email",m.email],["Phone",m.phone],["UPI",m.upi_id],["Merchant ID",m.id],
    ["Billed To / Counterparty",receipt.party],["Invoice / Receipt number",receipt.number],["Date",receipt.date],
    ["Payment rail",receipt.rows.every((r)=>r.is_simulated) ? "payIQ Wallet — simulated funds; Paytm Gateway disconnected" : "payIQ recorded payments; gateway not verified"],
  ];
  const headings = ["Date","Order / Transaction ID","Description","From","From UPI / Phone","From Email","To","To UPI / Phone","To Email","Direction","Status","Amount INR","Failure"];
  const lines = receipt.rows.map((r)=>[r.created_at,r.order_id,r.description || "Payment",r.from_party,r.from_upi,r.from_email,r.to_party,r.to_upi,r.to_email,r.direction,r.status,r.amount.toFixed(2),r.bank_error ?? ""]);
  if (format === "CSV") return { filename: `${receipt.number}.csv`, mime: "text/csv;charset=utf-8", text: [...metadata,[],headings,...lines,[],["Subtotal (all attempts)",receipt.subtotal.toFixed(2)],["Total settled amount INR",receipt.total.toFixed(2)]].map((r)=>r.map(csvCell).join(",")).join("\r\n") };
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  let y=20;
  const write=(text:string,size=10)=>{
    pdf.setFontSize(size);
    const wrapped=pdf.splitTextToSize(text.replace(/₹/g,"INR ").replace(/™/g," (TM) ").replace(/[\u2013\u2014]/g,"-"),180) as string[];
    for (const line of wrapped) { if(y>277){pdf.addPage();y=20;} pdf.text(line,14,y);y+=size===20?10:6; }
  };
  write("payIQ (TM)",20);
  metadata.forEach((r)=>write(r.join(": ")));
  const { autoTable } = await import("jspdf-autotable");
  autoTable(pdf, {
    startY:y+5,
    head:[["Date / Order ID","Description / Counterparty","Direction","Status","Amount INR"]],
    body:receipt.rows.map((r)=>[
      `${new Date(r.created_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}\n${r.order_id}`,
      `${r.description || "Payment"}\n${r.from_party} -> ${r.to_party}\n${r.to_upi || r.to_email}${r.bank_error?`\nFailure: ${r.bank_error}`:""}`,
      r.direction,r.status,r.amount.toFixed(2),
    ]),
    theme:"grid",styles:{fontSize:8,cellPadding:3,overflow:"linebreak"},
    columnStyles:{0:{cellWidth:47},1:{cellWidth:64},2:{cellWidth:22},3:{cellWidth:24},4:{cellWidth:25,halign:"right"}},
    margin:{left:14,right:14},
    didDrawPage:(data)=>{y=(data.cursor?.y ?? 250)+12;},
  });
  write(`Subtotal (all attempts): INR ${receipt.subtotal.toFixed(2)}`,11);
  write(`Total settled amount: INR ${receipt.total.toFixed(2)}`,12);
  write("Failed and pending attempts do not count toward the settled total. No GST or tax certification is implied.",9);
  return { filename:`${receipt.number}.pdf`,mime:"application/pdf",base64:pdf.output("datauristring").split(",")[1] ?? "" };
}