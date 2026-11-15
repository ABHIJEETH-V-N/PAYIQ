import { describe, it, expect } from "vitest";
import { buildReceipt, exportReceipt } from "@/lib/merchant-receipt";
import { filterLedger, type LedgerRow } from "@/lib/ledger-model";
const row:LedgerRow={id:"1",order_id:"SIM-1",from_party:"Merchant",to_party:"Bob",from_upi:"merchant@upi",to_upi:"bob@upi",from_email:"merchant@example.com",to_email:"bob@example.com",amount:150,status:"SUCCESS",direction:"DEBIT",source_type:"WALLET_TRANSFER",bank_error:null,retry_count:0,description:"Wallet transfer",created_at:"2026-11-14T19:00:00Z",is_simulated:true,audit_trail:[]};
const merchant={id:"merchant-id",name:"Merchant Store",email:"merchant@example.com",phone:"9999999991",upi_id:"merchant@upi"};
describe("merchant receipts and multidimensional filters",()=>{
  it("counts only successful payments in the settled total",()=>{
    const r=buildReceipt(merchant,[row,{...row,id:"2",status:"FAILED",amount:300}],"Bob");
    expect(r.total).toBe(150);expect(r.subtotal).toBe(450);
  });
  it("filters by recipient email, direction, status, source and India date",()=>{
    const f={party:"bob@example.com",status:"SUCCESS",direction:"DEBIT",source:"WALLET_TRANSFER",from:"2026-11-15",to:"2026-11-15",min:"100",max:"200"};
    expect(filterLedger([row,{...row,id:"2",direction:"CREDIT"}],f).map((r)=>r.id)).toEqual(["1"]);
    expect(filterLedger([row],{...f,source:"SYNC_REQUEST"})).toEqual([]);
  });
  it("CSV includes profile and transaction identifiers and escapes formulas",async()=>{
    const csv=await exportReceipt(buildReceipt(merchant,[{...row,description:"=DANGER"}],"Bob"),"CSV");
    expect(csv.text).toContain('"Merchant ID","merchant-id"');expect(csv.text).toContain('"bob@upi"');expect(csv.text).toContain('"\'=DANGER"');
  });
  it("creates a nonempty PDF receipt",async()=>{
    const pdf=await exportReceipt(buildReceipt(merchant,[row],"Bob"),"PDF");
    expect(atob(pdf.base64??"").startsWith("%PDF")).toBe(true);expect(pdf.base64?.length).toBeGreaterThan(1000);
  });
});