import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/smart-transfers.server", () => ({ notifyTransfer: vi.fn().mockResolvedValue({status:"SENT"}), executeSmartTransfer: vi.fn().mockResolvedValue({id:"transfer",status:"AWAITING_USER_AUTH",notification:{status:"SENT"},error:null}) }));
import { prepareSyncTransfer, confirmTransfer } from "@/lib/finance.functions";
import { notifyTransfer, executeSmartTransfer } from "@/lib/smart-transfers.server";

const invoke = (fn: unknown, db: unknown, data: unknown) => (fn as (input: unknown) => Promise<any>)({data,context:{supabase:db,userId:"owner"}});
function database(direction = "DEBIT", status = "SUCCESS") {
  const rpc = vi.fn(async (name: string) => ({error:null,data:name === "search_simulation_recipient" ? [{user_id:"recipient",name:"Bob",alias:"bob@example.com"}] : "transfer"}));
  const filters: [string,string][] = [];
  const chain = (data: unknown) => {
    const q = {select: () => q, eq: (k:string,v:string) => {filters.push([k,v]);return q;}, single: async () => ({data,error:null}), maybeSingle: async () => ({data,error:null})};
    return q;
  };
  return {rpc,filters,from:(table:string) => chain(table === "simulation_transfers" ? {status,sync_request_id:"sync",amount:150} : {counterparty_address:"bob@example.com",direction,sender_email:"sender@example.com",counterparty_email:"updates@example.com",email_updates:true})};
}
describe("reviewed sync execution", () => {
  beforeEach(() => vi.clearAllMocks());
  it("delegates policy evaluation to the atomic Smart Transfer function", async () => {
    const db = database();
    await invoke(prepareSyncTransfer, db, {id:"sync",amount:150});
    expect(executeSmartTransfer).toHaveBeenCalledWith(db,"owner","sync",150);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("never confirms a collection on behalf of its payer", async () => {
    const db = database("CREDIT");
    expect(await invoke(prepareSyncTransfer,db,{id:"sync",amount:150})).toMatchObject({status:"AWAITING_USER_AUTH"});
    expect(db.rpc.mock.calls.some(([name]) => name === "confirm_simulation_transfer")).toBe(false);
  });
  it("returns persisted failure instead of claiming a completed payment", async () => {
    expect(await invoke(confirmTransfer,database("DEBIT","FAILED"),"transfer")).toMatchObject({status:"FAILED",error:expect.stringContaining("Transfer failed")});
  });
});