import { it, expect, vi } from "vitest";
vi.mock("@tanstack/react-start",()=>({createServerFn:()=>{const builder={middleware:()=>builder,inputValidator:()=>builder,handler:(fn:unknown)=>fn};return builder;}}));
vi.mock("@/integrations/supabase/auth-middleware",()=>({requireSupabaseAuth:{}}));
import { getPartyStatement } from "@/lib/ledger.functions";
it("reads every owned page for a consolidated counterparty statement",async()=>{
  const ranges:number[][]=[];const filters:string[][]=[];
  const row={from_party:"Merchant",to_party:"Bob",from_upi:"merchant@upi",to_upi:"bob@upi",from_email:"m@example.com",to_email:"bob@example.com"};
  const q={select:()=>q,eq:(key:string,value:string)=>{filters.push([key,value]);return q;},order:()=>q,range:async(a:number,b:number)=>{ranges.push([a,b]);return {error:null,data:Array.from({length:a===0?500:1},(_,i)=>({...row,id:`${a+i}`}))};}};
  const invoke=getPartyStatement as unknown as (input:unknown)=>Promise<{id:string}[]>;
  const result=await invoke({data:{party:"bob@example.com"},context:{userId:"merchant",supabase:{from:()=>q}}});
  expect(result).toHaveLength(501);expect(ranges).toEqual([[0,499],[500,999]]);expect(filters).toEqual([["user_id","merchant"],["user_id","merchant"]]);
});