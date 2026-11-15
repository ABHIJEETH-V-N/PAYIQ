import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { grantSchema, teamSpecSchema, redactTeamText, maskTeamData } from "./teams-validation";
import { requireTeamRegion } from "./teams-region-middleware";

export const getTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireTeamRegion])
  .handler(async ({ context }) => {
    const [teams, records, audit, controls, drafts] = await Promise.all([
      context.supabase
        .from("teammates")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("teammate_records")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at")
        .limit(1000),
      context.supabase
        .from("teammate_audit")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(500),
      context.supabase
        .from("teammate_owner_controls")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("teammate_builder_drafts")
        .select("*")
        .eq("user_id", context.userId)
        .gt("expires_at", new Date().toISOString())
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);
    for (const result of [teams, records, audit, controls, drafts])
      if (result.error) throw new Error("Could not load your Teams records.");
    return {
      teams: teams.data ?? [],
      records: records.data ?? [],
      audit: audit.data ?? [],
      stopped: controls.data?.stopped ?? false,
      draft: drafts.data?.[0] ?? null,
    };
  });
export const createTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireTeamRegion])
  .inputValidator(teamSpecSchema)
  .handler(async ({ data, context }) => {
    const safe = teamSpecSchema.parse(maskTeamData(data));
    const result = await context.supabase.rpc("teammate_action", {
      p_action: "create",
      p_data: safe,
    });
    if (result.error) throw new Error(result.error.message);
    await context.supabase.from("teammate_builder_drafts").delete().eq("user_id", context.userId);
    return result.data;
  });
export const manageTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireTeamRegion])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      action: z.enum([
        "pause",
        "stop_all",
        "retire",
        "restore",
        "rename",
        "grant",
        "revoke",
        "renew",
        "attach_policy",
        "publish_policy",
        "detach_policy",
        "activate",
        "report",
        "ask_human",
      ]),
      values: z
        .object({
          name: z.string().trim().max(80).optional(),
          record_id: z.string().uuid().optional(),
          policy_id: z.string().uuid().optional(),
          run_id: z.string().uuid().optional(),
          message: z.string().trim().max(1000).optional(),
          grant: grantSchema.optional(),
        })
        .default({}),
    }),
  )
  .handler(async ({ data, context }) => {
    const values = data.action === "grant" ? grantSchema.parse(data.values.grant) : data.values;
    const result = await context.supabase.rpc("teammate_action", {
      p_action: data.action,
      ...(data.id ? { p_id: data.id } : {}),
      p_data: JSON.parse(JSON.stringify(maskTeamData(values))),
    });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
export const saveBuilderDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireTeamRegion])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      answers: z.array(z.string().max(2000)).max(7),
      spec: teamSpecSchema.optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const safe = JSON.parse(
      JSON.stringify(maskTeamData({ answers: data.answers, spec: data.spec })),
    );
    const values = { data: safe, expires_at: new Date(Date.now() + 86400000).toISOString() };
    const query = data.id
      ? context.supabase
          .from("teammate_builder_drafts")
          .update(values)
          .eq("id", data.id)
          .eq("user_id", context.userId)
      : context.supabase
          .from("teammate_builder_drafts")
          .insert({ ...values, user_id: context.userId });
    const result = await query.select("id").single();
    if (result.error) throw new Error("Could not save the builder draft.");
    return result.data;
  });
export const proposeTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireTeamRegion])
  .inputValidator(z.array(z.string().trim().min(1).max(2000)).length(7))
  .handler(async ({ data }) => {
    const { buildTeamProposal } = await import("./teams-runtime.server");
    return buildTeamProposal(data.map(redactTeamText));
  });
export const evaluateTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireTeamRegion])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    const { evaluateTeam } = await import("./teams-runtime.server");
    return evaluateTeam(context.supabase, context.userId, data);
  });
export const messageTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireTeamRegion])
  .inputValidator(z.object({ id: z.string().uuid(), text: z.string().trim().min(1).max(10000) }))
  .handler(async ({ data, context }) => {
    const { runTeam } = await import("./teams-runtime.server");
    return runTeam(context.supabase, context.userId, data.id, redactTeamText(data.text));
  });
export const parseTeamDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireTeamRegion])
  .inputValidator((input: FormData) => {
    if (!(input instanceof FormData)) throw new Error("Invalid upload.");
    const file = input.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024)
      throw new Error("Choose a file up to 10 MB.");
    z.string().uuid().parse(input.get("id"));
    z.string().uuid().parse(input.get("record_id"));
    return input;
  })
  .handler(async ({ data, context }) => {
    const { parseTeamUpload } = await import("./teams-runtime.server");
    return parseTeamUpload(context.supabase, context.userId, data);
  });
