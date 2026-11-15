// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const owner = "a0000000-0000-4000-8000-000000000001",
  other = "a0000000-0000-4000-8000-000000000002";
let team = "";
async function user(id: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`,
  );
  return db.query(sql, params);
}
beforeAll(async () => {
  await db.exec(
    `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA payiq_private; GRANT USAGE ON SCHEMA auth,payiq_private TO authenticated; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; CREATE TABLE public.profiles(id uuid PRIMARY KEY); INSERT INTO public.profiles VALUES('${owner}'),('${other}'); CREATE TABLE public.payment_policies(id uuid PRIMARY KEY,user_id uuid,name text); INSERT INTO public.payment_policies VALUES('b0000000-0000-4000-8000-000000000001','${owner}','Standard'); CREATE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;`,
  );
  for (const file of readdirSync("supabase/migrations")
    .sort()
    .filter((f) => f >= "20261115051312"))
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  const result = await user(owner, "select public.teammate_action('create',NULL,$1) as result", [
    JSON.stringify({
      name: "Test teammate",
      role: "custom",
      goal: "Help with support",
      documents_needed: [],
      connections_needed: [],
    }),
  ]);
  team = (result.rows[0] as { result: { id: string } }).result.id;
}, 30000);
afterAll(() => db.close());
describe("Teams database controls", () => {
  it("creates configuring teammates with no scopes", async () => {
    expect((await user(owner, "select status from public.teammates")).rows).toEqual([
      { status: "configuring" },
    ]);
    expect(
      (await user(owner, "select * from public.teammate_records where kind='scope'")).rows,
    ).toHaveLength(0);
  });
  it("isolates owner rows", async () =>
    expect((await user(other, "select * from public.teammates")).rows).toHaveLength(0));
  it("blocks other owners from changes", async () => {
    await expect(user(other, "select public.teammate_action('pause',$1)", [team])).rejects.toThrow(
      /not found/,
    );
  });
  it("forbids direct scope writes", async () => {
    await expect(
      user(
        owner,
        "insert into public.teammate_records(user_id,teammate_id,kind) values($1,$2,'scope')",
        [owner, team],
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("forbids write scope escalation", async () => {
    await expect(
      user(owner, "select public.teammate_action('grant',$1,$2)", [
        team,
        JSON.stringify({ scope: "write:scope", purpose: "override", categories: "all" }),
      ]),
    ).rejects.toThrow(/not grantable/);
  });
  it("requires consent purpose", async () => {
    await expect(
      user(owner, "select public.teammate_action('grant',$1,$2)", [
        team,
        JSON.stringify({ scope: "read:transactions", purpose: "", categories: "amount" }),
      ]),
    ).rejects.toThrow(/Purpose/);
  });
  it("grants scopes for exactly 90 days", async () => {
    await user(owner, "select public.teammate_action('grant',$1,$2)", [
      team,
      JSON.stringify({
        scope: "read:transactions",
        purpose: "Review amounts",
        categories: "amount",
        approval: "none",
        limit_per_action_paise: null,
        daily_cap_paise: null,
      }),
    ]);
    const rows = await user(
      owner,
      "select round(extract(epoch from ((data->>'expires_at')::timestamptz-created_at))/86400) as days from public.teammate_records where kind='scope'",
    );
    expect(rows.rows).toEqual([{ days: "90" }]);
  });
  it("cannot activate without passed current evaluation", async () => {
    await expect(
      user(owner, "select public.teammate_action('activate',$1)", [team]),
    ).rejects.toThrow(/evaluation/);
  });
  it("cannot run a configuring teammate", async () => {
    await expect(
      user(owner, "select public.teammate_runtime_write($1,'begin','{\"text\":\"hello\"}')", [
        team,
      ]),
    ).rejects.toThrow(/not active/);
  });
  it("audit cannot be updated", async () => {
    await expect(user(owner, "update public.teammate_audit set outcome='changed'")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("audit cannot be deleted", async () => {
    await expect(
      user(owner, "delete from public.teammate_audit where user_id=$1", [owner]),
    ).rejects.toThrow(/permission denied/);
  });
  it("stop all sets durable switches", async () => {
    await user(owner, "select public.teammate_action('stop_all')");
    expect((await user(owner, "select status,kill_switch from public.teammates")).rows).toEqual([
      { status: "paused", kill_switch: true },
    ]);
  });
  it("redacts sensitive direct-chat writes before storage", async () => {
    await db.exec("RESET ROLE");
    await db.query("update public.teammates set status='active',kill_switch=false where id=$1", [
      team,
    ]);
    await db.query("update public.teammate_owner_controls set stopped=false where user_id=$1", [
      owner,
    ]);
    await user(owner, "select public.teammate_runtime_write($1,'begin',$2)", [
      team,
      JSON.stringify({ text: "password: unsafe-example ABCDE1234F 1234 5678 9012" }),
    ]);
    const result = await user(
      owner,
      "select data->>'text' as text from public.teammate_records where kind='message'",
    );
    const text = String((result.rows[0] as { text: string }).text);
    for (const sensitive of ["unsafe-example", "ABCDE1234F", "1234"])
      expect(text).not.toContain(sensitive);
  });
  it("cancels running work when paused", async () => {
    await user(owner, "select public.teammate_action('pause',$1)", [team]);
    expect(
      (
        await user(
          owner,
          "select data->>'status' as status from public.teammate_records where kind='run'",
        )
      ).rows,
    ).toEqual([{ status: "cancelled" }]);
  });
  it("scope changes invalidate a previously evaluated configuration", async () => {
    await db.exec("RESET ROLE");
    await db.query(
      "update public.teammates set evaluated_version=version,evaluation='{\"passed\":true}' where id=$1",
      [team],
    );
    await user(owner, "select public.teammate_action('grant',$1,$2)", [
      team,
      JSON.stringify({
        scope: "read:documents",
        purpose: "Answer questions",
        categories: "approved summaries",
        approval: "none",
        limit_per_action_paise: null,
        daily_cap_paise: null,
      }),
    ]);
    await expect(
      user(owner, "select public.teammate_action('activate',$1)", [team]),
    ).rejects.toThrow(/evaluation/);
  });
  it("retired teammates recover within 30 days", async () => {
    await user(owner, "select public.teammate_action('retire',$1)", [team]);
    await user(owner, "select public.teammate_action('restore',$1)", [team]);
    expect((await user(owner, "select status from public.teammates")).rows).toEqual([
      { status: "configuring" },
    ]);
  });
  it("retired teammates cannot recover after 30 days", async () => {
    await user(owner, "select public.teammate_action('retire',$1)", [team]);
    await db.exec("RESET ROLE");
    await db.query("update public.teammates set retired_at=now()-interval '31 days' where id=$1", [
      team,
    ]);
    await expect(
      user(owner, "select public.teammate_action('restore',$1)", [team]),
    ).rejects.toThrow(/Recovery period ended/);
  });
});
