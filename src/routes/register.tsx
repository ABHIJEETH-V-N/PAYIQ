import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout, Field } from "@/components/app/AuthLayout";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  head: () =>
    seo("Create account — payIQ", "Register your business on payIQ and link your Paytm account."),
  component: Register,
});

function Register() {
  const next = oauthReturnPath(Route.useSearch().next ?? "/dashboard");
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <AuthLayout
      title="Set up your business"
      subtitle="Takes about a minute. Link your Paytm details to get started."
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          const f = new FormData(e.currentTarget);
          try {
            const { data, error } = await supabase.auth.signUp({
              email: String(f.get("email")),
              password: String(f.get("password")),
              options: {
                emailRedirectTo: new URL(next, window.location.origin).href,
                data: {
                  name: String(f.get("name")),
                  phone: String(f.get("phone")),
                  paytm_number: String(f.get("paytm_number")),
                  upi_id: String(f.get("upi_id")),
                },
              },
            });
            if (error) throw error;
            if (data.session) window.location.assign(next);
            else setMessage("Check your email to confirm your account before signing in.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not create account");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="sm:col-span-2">
          <Field name="name" label="Business name" placeholder="Sharma Kirana & Co." required />
        </div>
        <div className="sm:col-span-2">
          <Field name="email" label="Email" type="email" placeholder="you@business.in" required />
        </div>
        <div className="sm:col-span-2">
          <Field
            name="password"
            minLength={8}
            autoComplete="new-password"
            label="Password"
            type="password"
            placeholder="••••••••"
            required
          />
        </div>
        <Field name="phone" label="Phone number" type="tel" placeholder="+91" required />
        <Field
          name="paytm_number"
          label="Paytm number"
          type="tel"
          placeholder="98XXX XXXXX"
          required
        />
        <div className="sm:col-span-2">
          <Field name="upi_id" label="UPI ID" placeholder="business@paytm" required />
        </div>
        <Button
          variant="brand"
          size="lg"
          className="w-full sm:col-span-2"
          type="submit"
          disabled={busy}
        >
          {busy ? "Creating account…" : "Create account"}
        </Button>
        {message && (
          <p role="status" className="text-sm sm:col-span-2">
            {message}
          </p>
        )}
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/" className="font-semibold text-sky">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
