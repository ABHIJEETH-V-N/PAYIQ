// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const alice = "a0000000-0000-4000-8000-000000000001",
  bob = "a0000000-0000-4000-8000-000000000002",
  eve = "a0000000-0000-4000-8000-000000000003";
const db = new PGlite();
async function asUser(id: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`,
  );
  return db.query(sql, params);
}
beforeAll(async () => {
  await db.exec(
    `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}'); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; CREATE SCHEMA storage; CREATE TABLE storage.objects(name text,bucket_id text); CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;`,
  );
  for (const name of readdirSync("supabase/migrations").sort()) {
    let sql = readFileSync(`supabase/migrations/${name}`, "utf8");
    if (
      name.includes("145506") ||
      name.includes("145936") ||
      name.includes("161639") ||
      name.includes("165718") ||
      name.includes("165842")
    )
      await db.exec(sql);
  }
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${alice}','alice@example.com'),('${bob}','bob@example.com');`);
  for (const name of readdirSync("supabase/migrations").sort()) {
    if (name.includes("173055") || name.includes("173216")) await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  }
  for (const name of readdirSync("supabase/migrations").sort()) {
    if (name >= "20261114174550") {
      let sql = readFileSync(`supabase/migrations/${name}`, "utf8");
      sql = sql.replace("CREATE EXTENSION IF NOT EXISTS pg_cron;", "").replace(/CREATE TRIGGER smart_transfers_arm[^;]+;/g, "").replace(/DROP TRIGGER smart_transfers_arm[^;]+;/g, "");
      await db.exec(sql);
    }
  }
  await db.exec(`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('${eve}','eve@example.com','{"phone":"9999999993","upi_id":"eve@sim"}');`);
  await asUser(alice, "select public.configure_simulation_wallet('9999999991','alice@sim',true)");
  await asUser(bob, "select public.configure_simulation_wallet('9999999992','bob@sim',true)");
  await asUser(alice, "select public.top_up_simulation_wallet(1000)");
}, 30000);
afterAll(() => db.close());
describe("fake transfer database invariants", () => {
  it("starts existing users at 10000 with discovery enabled", async () => {
    expect((await asUser(bob, "select balance,discoverable,email from public.simulation_wallets")).rows).toEqual([{balance:"10000.00",discoverable:true,email:"bob@example.com"}]);
  });
  it("starts new users at 10000 with prefilled account identifiers", async () => {
    expect((await asUser(eve, "select balance,discoverable,email,phone,upi_id from public.simulation_wallets")).rows).toEqual([{balance:"10000.00",discoverable:true,email:"eve@example.com",phone:"9999999993",upi_id:"eve@sim"}]);
  });
  it("matches exact account email without exposing balance", async () => {
    expect((await asUser(alice, "select * from public.search_simulation_recipient(' BOB@EXAMPLE.COM ')")).rows).toEqual([{user_id:bob,name:"",alias:"bob@example.com"}]);
    expect((await asUser(alice, "select * from public.search_simulation_recipient('example.com')")).rows).toHaveLength(0);
  });
  it("records a top-up as simulated credit", async () => {
    expect((await asUser(alice, "select amount,direction,status,is_simulated from public.transactions where order_id like 'SIM-TOPUP-%'")).rows).toEqual([{amount:"1000.00",direction:"CREDIT",status:"SUCCESS",is_simulated:true}]);
    expect((await asUser(alice,"select source_type,to_upi,description,jsonb_array_length(audit_trail)>0 as audited from public.ledger_transactions where order_id like 'SIM-TOPUP-%'")).rows).toEqual([{source_type:"WALLET_TRANSFER",to_upi:"alice@sim",description:"Add balance",audited:true}]);
  });
  it("cannot edit fake balance directly", async () => {
    await expect(
      asUser(alice, "update public.simulation_wallets set balance=99999"),
    ).rejects.toThrow(/permission denied/);
  });
  it("search is exact, opted in, and hides balances", async () => {
    const r = await asUser(alice, "select * from public.search_simulation_recipient('bob@sim')");
    expect(r.rows).toEqual([{ user_id: bob, name: "", alias: "bob@sim" }]);
    expect(
      (await asUser(alice, "select * from public.search_simulation_recipient('bob')")).rows,
    ).toHaveLength(0);
    expect((await asUser(alice, "select * from public.simulation_wallets")).rows).toHaveLength(1);
  });
  it("payer confirmation conserves balances, creates paired rows, and is idempotent", async () => {
    const p = await asUser(alice, "select public.prepare_simulation_transfer($1,250) as id", [bob]);
    const id = (p.rows[0] as { id: string }).id;
    await expect(
      asUser(eve, "select public.confirm_simulation_transfer($1)", [id]),
    ).rejects.toThrow(/Only payer/);
    await asUser(alice, "select public.confirm_simulation_transfer($1)", [id]);
    await asUser(alice, "select public.confirm_simulation_transfer($1)", [id]);
    await db.exec("RESET ROLE");
    const w = await db.query<{ balance: string }>(
      "select balance from public.simulation_wallets where user_id in($1,$2) order by user_id",
      [alice, bob],
    );
    expect(w.rows.map((r) => Number(r.balance))).toEqual([10750, 10250]);
    const tx = await db.query(
      "select direction,amount,is_simulated from public.transactions where order_id not like 'SIM-TOPUP-%' order by direction",
    );
    expect(tx.rows).toEqual([
      { direction: "CREDIT", amount: "250.00", is_simulated: true },
      { direction: "DEBIT", amount: "250.00", is_simulated: true },
    ]);
    const enriched=await db.query("select direction,source_type,to_upi,to_email,jsonb_array_length(audit_trail)>0 as audited from public.transactions where order_id not like 'SIM-TOPUP-%' order by direction");
    expect(enriched.rows).toEqual([{direction:"CREDIT",source_type:"WALLET_TRANSFER",to_upi:"bob@sim",to_email:"bob@example.com",audited:true},{direction:"DEBIT",source_type:"WALLET_TRANSFER",to_upi:"bob@sim",to_email:"bob@example.com",audited:true}]);
  });
  it("insufficient balance changes neither wallet", async () => {
    const p = await asUser(alice, "select public.prepare_simulation_transfer($1,20000) as id", [
      bob,
    ]);
    const id = (p.rows[0] as { id: string }).id;
    await asUser(alice, "select public.confirm_simulation_transfer($1)", [id]);
    await asUser(alice, "select public.confirm_simulation_transfer($1)", [id]);
    expect((await asUser(alice, "select status,bank_error from public.transactions where order_id=$1", [`SIM-${id}-D`])).rows).toEqual([{status:"FAILED",bank_error:"INSUFFICIENT_WALLET_BALANCE"}]);
    expect((await asUser(alice, "select balance from public.simulation_wallets")).rows).toEqual([
      { balance: "10750.00" },
    ]);
    expect((await asUser(bob,"select direction,status,bank_error,jsonb_array_length(audit_trail)>1 as audited from public.ledger_transactions where order_id=$1",[`SIM-${id}-C`])).rows).toEqual([{direction:"CREDIT",status:"FAILED",bank_error:"INSUFFICIENT_WALLET_BALANCE",audited:true}]);
  });
  it("collection never spends the counterparty balance without their confirmation", async () => {
    await db.exec("RESET ROLE");
    const policy = await db.query<{ id: string }>(
      "select id from public.payment_policies where user_id=$1 limit 1",
      [alice],
    );
    const s = await asUser(
      alice,
      "insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,max_cap,policy_id) values($1,'Collection','Bob','bob@sim','CREDIT','VARIABLE',200,$2) returning id",
      [alice, policy.rows[0]?.id],
    );
    const sync = (s.rows[0] as { id: string }).id;
    await expect(
      asUser(alice, "select public.prepare_simulation_transfer($1,201,$2)", [bob, sync]),
    ).rejects.toThrow(/exceeds cap/);
    const p = await asUser(alice, "select public.prepare_simulation_transfer($1,100,$2) as id", [
      bob,
      sync,
    ]);
    const id = (p.rows[0] as { id: string }).id;
    await expect(
      asUser(alice, "select public.confirm_simulation_transfer($1)", [id]),
    ).rejects.toThrow(/Only payer/);
    await asUser(bob, "select public.confirm_simulation_transfer($1)", [id]);
    expect((await asUser(alice, "select balance from public.simulation_wallets")).rows).toEqual([
      { balance: "10850.00" },
    ]);
    expect((await asUser(bob, "select balance from public.simulation_wallets")).rows).toEqual([
      { balance: "10150.00" },
    ]);
  });
  it("rejects self-transfers, invalid decimals and duplicate alias claims", async () => {
    await expect(
      asUser(alice, "select public.prepare_simulation_transfer($1,10)", [alice]),
    ).rejects.toThrow(/yourself/);
    await expect(asUser(alice, "select public.top_up_simulation_wallet(0.001)")).rejects.toThrow();
    await expect(
      asUser(eve, "select public.configure_simulation_wallet('9999999992','',true)"),
    ).rejects.toThrow(/duplicate/);
  });
  it("executes an email-matched payout and updates its sync timeline", async () => {
    const policy = (await asUser(alice, "select id from public.payment_policies limit 1")).rows[0] as {id:string};
    const s = await asUser(alice, "insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,amount,policy_id) values($1,'Email payout','Bob','bob@example.com','DEBIT','FIXED',150,$2) returning id", [alice,policy.id]);
    const sync = (s.rows[0] as {id:string}).id;
    const p = await asUser(alice, "select public.prepare_simulation_transfer($1,150,$2) as id", [bob,sync]);
    const id = (p.rows[0] as {id:string}).id;
    await asUser(alice, "select public.confirm_simulation_transfer($1)", [id]);
    expect((await asUser(alice, "select status,last_at is not null as ran from public.sync_requests where id=$1", [sync])).rows).toEqual([{status:"COMPLETED",ran:true}]);
    expect((await asUser(alice, "select balance from public.simulation_wallets")).rows).toEqual([{balance:"10700.00"}]);
    expect((await asUser(bob, "select balance from public.simulation_wallets")).rows).toEqual([{balance:"10300.00"}]);
  });
  it("repairs a missing owned wallet before top-up", async () => {
    await db.exec("RESET ROLE");
    await db.query("delete from public.simulation_wallets where user_id=$1", [eve]);
    expect((await asUser(eve, "select public.top_up_simulation_wallet(500) as balance")).rows).toEqual([{balance:"10500.00"}]);
  });
  it("automatically pays an approved debit and notifies only its recipient", async () => {
    const policy = await asUser(alice, "insert into public.payment_policies(user_id,name,requires_user_auth,auto_approve_limit) values($1,'Auto cap',false,100) returning id", [alice]);
    const s = await asUser(alice, "insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,amount,policy_id) values($1,'Auto debit','Bob','bob@sim','DEBIT','FIXED',80,$2) returning id", [alice,(policy.rows[0] as {id:string}).id]);
    const id = (s.rows[0] as {id:string}).id;
    const transfer = (await asUser(alice, "select public.execute_smart_transfer($1,80) as id", [id])).rows[0] as {id:string};
    expect((await asUser(alice, "select status from public.simulation_transfers where id=$1", [transfer.id])).rows).toEqual([{status:"SUCCESS"}]);
    expect((await asUser(bob, "select type,is_read from public.notifications where related_id=$1 and type='TRANSFER'", [transfer.id])).rows).toEqual([{type:"TRANSFER",is_read:false}]);
    expect((await asUser(eve, "select * from public.notifications where related_id=$1", [transfer.id])).rows).toEqual([]);
    await expect(asUser(eve,"insert into public.notifications(user_id,title,message,type) values($1,'spoof','spoof','TRANSFER')",[bob])).rejects.toThrow(/permission denied/);
  });
  it("requires approval above the automatic debit cap", async () => {
    const policy = await asUser(alice,"insert into public.payment_policies(user_id,name,requires_user_auth,auto_approve_limit) values($1,'Cap',false,100) returning id",[alice]);
    const s = await asUser(alice,"insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,amount,policy_id) values($1,'Over cap','Bob','bob@sim','DEBIT','FIXED',101,$2) returning id",[alice,(policy.rows[0] as {id:string}).id]);
    const id=(s.rows[0] as {id:string}).id;
    await asUser(alice,"select public.execute_smart_transfer($1,101)",[id]);
    expect((await asUser(alice,"select status from public.sync_requests where id=$1",[id])).rows).toEqual([{status:"AWAITING_USER_AUTH"}]);
  });
  it("honors ask-before-every-debit even below the limit", async () => {
    const policy=await asUser(alice,"insert into public.payment_policies(user_id,name,requires_user_auth,auto_approve_limit) values($1,'Always ask',true,100) returning id",[alice]);
    const s=await asUser(alice,"insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,amount,policy_id) values($1,'Ask debit','Bob','bob@sim','DEBIT','FIXED',50,$2) returning id",[alice,(policy.rows[0] as {id:string}).id]);
    const id=(s.rows[0] as {id:string}).id;
    await asUser(alice,"select public.execute_smart_transfer($1,50)",[id]);
    expect((await asUser(alice,"select status from public.sync_requests where id=$1",[id])).rows).toEqual([{status:"AWAITING_USER_AUTH"}]);
  });
  it("creates a cross-user collection card without spending the payer balance", async () => {
    const before=(await asUser(bob,"select balance from public.simulation_wallets")).rows;
    const policy=(await asUser(alice,"select id from public.payment_policies limit 1")).rows[0] as {id:string};
    const s=await asUser(alice,"insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,amount,policy_id) values($1,'Incoming collection','Bob','bob@sim','CREDIT','FIXED',70,$2) returning id",[alice,policy.id]);
    const transfer=(await asUser(alice,"select public.execute_smart_transfer($1,70) as id",[(s.rows[0] as {id:string}).id])).rows[0] as {id:string};
    expect((await asUser(bob,"select balance from public.simulation_wallets")).rows).toEqual(before);
    expect((await asUser(bob,"select type,is_read from public.notifications where related_id=$1",[transfer.id])).rows).toEqual([{type:"COLLECTION",is_read:false}]);
    await expect(asUser(alice,"select public.confirm_simulation_transfer($1)",[transfer.id])).rejects.toThrow(/Only payer/);
    await asUser(bob,"select public.confirm_simulation_transfer($1)",[transfer.id]);
    expect((await asUser(bob,"select balance from public.simulation_wallets")).rows).toEqual([{balance:String(Number((before[0] as {balance:string}).balance)-70)+".00"}]);
  });

  it("defers a future execution date without debiting", async () => {
    const policy=await asUser(alice,"insert into public.payment_policies(user_id,name,requires_user_auth,execution_date) values($1,'Future',false,current_date+1) returning id",[alice]);
    const s=await asUser(alice,"insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,amount,policy_id) values($1,'Future debit','Bob','bob@sim','DEBIT','FIXED',50,$2) returning id",[alice,(policy.rows[0] as {id:string}).id]);
    const id=(s.rows[0] as {id:string}).id;
    expect((await asUser(alice,"select public.execute_smart_transfer($1,50) as id",[id])).rows).toEqual([{id:null}]);
    expect((await asUser(alice,"select count(*)::int as count from public.simulation_transfers where sync_request_id=$1",[id])).rows).toEqual([{count:0}]);
  });
  it("returns only an exact opted-in recipient email and no balance", async () => {
    expect((await asUser(alice,"select * from public.lookup_wallet_recipient('bob@sim')")).rows).toEqual([{user_id:bob,name:"",alias:"bob@sim",email:"bob@example.com"}]);
  });

  it("stops after two retries and respects the 15-minute delay", async () => {
    const policy=await asUser(alice,"insert into public.payment_policies(user_id,name,requires_user_auth,max_retries,retry_delay_seconds) values($1,'Two retries',false,2,900) returning id",[alice]);
    const s=await asUser(alice,"insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,amount,policy_id) values($1,'Insufficient funds','Bob','bob@sim','DEBIT','FIXED',100000,$2) returning id",[alice,(policy.rows[0] as {id:string}).id]);
    const id=(s.rows[0] as {id:string}).id;
    await asUser(alice,"select public.execute_smart_transfer($1,100000)",[id]);
    expect((await asUser(alice,"select retry_attempts,extract(epoch from(next_execution_at-last_at))::int as delay from public.sync_requests where id=$1",[id])).rows).toEqual([{retry_attempts:0,delay:900}]);
    expect((await asUser(alice,"select public.execute_smart_transfer($1,100000) as id",[id])).rows).toEqual([{id:null}]);
    for (let retry=1;retry<=2;retry++) {
      await db.exec("RESET ROLE"); await db.query("update public.sync_requests set next_execution_at=now()-interval '1 second' where id=$1",[id]);
      await asUser(alice,"select public.execute_smart_transfer($1,100000)",[id]);
      expect((await asUser(alice,"select retry_attempts from public.sync_requests where id=$1",[id])).rows).toEqual([{retry_attempts:retry}]);
    }
    await expect(asUser(alice,"select public.execute_smart_transfer($1,100000)",[id])).rejects.toThrow(/Retry limit/);
    expect((await asUser(alice,"select count(*)::int as count from public.simulation_transfers where sync_request_id=$1",[id])).rows).toEqual([{count:3}]);
  });

  it("settles a ₹100 collection exactly once with automated paired ledger rows and Completed status", async () => {
    const policy=(await asUser(alice,"select id from public.payment_policies limit 1")).rows[0] as {id:string};
    const s=(await asUser(alice,"insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,amount,policy_id) values($1,'Dev collection','Bob','bob@sim','CREDIT','FIXED',100,$2) returning id",[alice,policy.id])).rows[0] as {id:string};
    const t=(await asUser(alice,"select public.execute_smart_transfer($1,100) as id",[s.id])).rows[0] as {id:string};
    expect((await asUser(bob,"select name,amount from public.pending_collection_requests() where id=$1",[t.id])).rows).toEqual([{name:"Dev collection",amount:"100.00"}]);
    expect((await asUser(eve,"select * from public.pending_collection_requests() where id=$1",[t.id])).rows).toEqual([]);
    const beforeBob=(await asUser(bob,"select balance from public.simulation_wallets")).rows[0] as {balance:string};
    const beforeAlice=(await asUser(alice,"select balance from public.simulation_wallets")).rows[0] as {balance:string};
    await expect(asUser(alice,"update public.sync_requests set amount=200 where id=$1",[s.id])).rejects.toThrow(/cancel the pending/);
    await asUser(bob,"select public.confirm_simulation_transfer($1)",[t.id]);
    await asUser(bob,"select public.confirm_simulation_transfer($1)",[t.id]);
    expect(Number(((await asUser(bob,"select balance from public.simulation_wallets")).rows[0] as {balance:string}).balance)).toBe(Number(beforeBob.balance)-100);
    expect(Number(((await asUser(alice,"select balance from public.simulation_wallets")).rows[0] as {balance:string}).balance)).toBe(Number(beforeAlice.balance)+100);
    expect((await asUser(alice,"select status from public.sync_requests where id=$1",[s.id])).rows).toEqual([{status:"COMPLETED"}]);
    for (const user of [alice,bob]) expect((await asUser(user,"select amount,is_automated,source_type from public.ledger_transactions where order_id in($1,$2)",[`SIM-${t.id}-D`,`SIM-${t.id}-C`])).rows).toEqual([{amount:"100.00",is_automated:true,source_type:"SYNC_REQUEST"}]);
    await expect(asUser(alice,"select public.prepare_simulation_transfer($1,100,$2)",[bob,s.id])).rejects.toThrow(/no longer active/);
  });
  it("declines a collection without moving funds and clears pending requests", async () => {
    const policy=(await asUser(alice,"select id from public.payment_policies limit 1")).rows[0] as {id:string};
    const s=(await asUser(alice,"insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,amount,policy_id) values($1,'Decline collection','Bob','bob@sim','CREDIT','FIXED',100,$2) returning id",[alice,policy.id])).rows[0] as {id:string};
    const t=(await asUser(alice,"select public.execute_smart_transfer($1,100) as id",[s.id])).rows[0] as {id:string};
    const before=(await asUser(bob,"select balance from public.simulation_wallets")).rows;
    await expect(asUser(eve,"select public.cancel_simulation_transfer($1)",[t.id])).rejects.toThrow(/not found/);
    await asUser(bob,"select public.cancel_simulation_transfer($1)",[t.id]);
    expect((await asUser(bob,"select balance from public.simulation_wallets")).rows).toEqual(before);
    expect((await asUser(bob,"select * from public.pending_collection_requests() where id=$1",[t.id])).rows).toEqual([]);
    expect((await asUser(alice,"select status from public.sync_requests where id=$1",[s.id])).rows).toEqual([{status:"CANCELLED"}]);
  });
  it("schedules five/ten-hour reminders and 9 AM India reminders with no schedule for None or due/failure", async () => {
    await db.exec("RESET ROLE");
    const result=await db.query("select payiq_private.next_reminder('5_HOURS','2026-11-14T00:00:00Z') as five,payiq_private.next_reminder('10_HOURS','2026-11-14T00:00:00Z') as ten,payiq_private.next_reminder('MORNING','2026-11-14T00:00:00Z') as morning,payiq_private.next_reminder('MORNING','2026-11-14T04:00:00Z') as tomorrow,payiq_private.next_reminder('NONE',now()) as none,payiq_private.next_reminder('DUE_FAILURE',now()) as due");
    const r=result.rows[0] as {five:Date|null;ten:Date|null;morning:Date|null;tomorrow:Date|null;none:Date|null;due:Date|null};
    expect(r.five?.toISOString()).toBe('2026-11-14T05:00:00.000Z'); expect(r.ten?.toISOString()).toBe('2026-11-14T10:00:00.000Z'); expect(r.morning?.toISOString()).toBe('2026-11-14T03:30:00.000Z'); expect(r.tomorrow?.toISOString()).toBe('2026-11-15T03:30:00.000Z'); expect(r.none).toBeNull(); expect(r.due).toBeNull();
  });
  it("creates immediate owner-authorized reminders with cap, amount and email preference", async () => {
    const policy=(await asUser(alice,"select id from public.payment_policies limit 1")).rows[0] as {id:string};
    const s=(await asUser(alice,"insert into public.sync_requests(user_id,name,counterparty,counterparty_address,direction,amount_type,max_cap,policy_id,email_reminders,reminder_cadence) values($1,'Reminder demo','Bob','bob@sim','CREDIT','VARIABLE',200,$2,false,'5_HOURS') returning id,extract(epoch from(next_reminder_at-created_at))::int as delay",[alice,policy.id])).rows[0] as {id:string,delay:number};
    expect(s.delay).toBe(18000);
    await asUser(alice,"select public.execute_smart_transfer($1,100)",[s.id]);
    await expect(asUser(eve,"select public.send_smart_reminder($1)",[s.id])).rejects.toThrow(/not found/);
    const n=(await asUser(alice,"select public.send_smart_reminder($1) as id",[s.id])).rows[0] as {id:string};
    const notice=(await asUser(bob,"select message,send_email from public.notifications where id=$1",[n.id])).rows[0] as {message:string,send_email:boolean};
    expect(notice.message).toContain('₹100'); expect(notice.message).toContain('₹200'); expect(notice.message).toContain('AWAITING_USER_AUTH'); expect(notice.send_email).toBe(false);
  });
});
