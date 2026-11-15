import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/app/AuthLayout";
import { seo } from "@/lib/seo";
export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () =>
    seo("Connect finance assistant — payIQ", "Review access to your private payIQ finance tools."),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing or expired authorization request");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session)
      throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id");
    if (!id) throw new Error("Missing authorization request");
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
    if (error) throw error;
    if (data && "redirect_url" in data && data.redirect_url)
      throw redirect({ href: data.redirect_url });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <AuthLayout
      title="Connection unavailable"
      subtitle={error instanceof Error ? error.message : "Could not load authorization"}
    >
      <a href="/auth">Return to sign in</a>
    </AuthLayout>
  ),
});
function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(yes: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = yes
        ? await supabase.auth.oauth.approveAuthorization(authorization_id)
        : await supabase.auth.oauth.denyAuthorization(authorization_id);
      if (r.error) throw r.error;
      const url = r.data?.redirect_url;
      if (!url) throw new Error("No return address received");
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setBusy(false);
    }
  }
  const name = details && "client" in details ? details.client.name : "this assistant";
  return (
    <AuthLayout
      title={`Connect ${name}`}
      subtitle="Allow access to your private finance records and policy tools. Wallet transfers still need payer confirmation."
    >
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-3">
        <Button disabled={busy} variant="brand" onClick={() => decide(true)}>
          Approve
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => decide(false)}>
          Deny
        </Button>
      </div>
    </AuthLayout>
  );
}
