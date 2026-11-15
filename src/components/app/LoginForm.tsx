import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { useState } from "react";
import { AuthLayout, Field } from "./AuthLayout";
import { PaytmSignInButton } from "./PaytmButton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
export function LoginForm() {
  const nav = useNavigate();
  const search = useSearch({ strict: false });
  const next = oauthReturnPath("next" in search && search.next ? search.next : "/dashboard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your payIQ account.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const r = await supabase.auth.signInWithPassword({
              email: String(f.get("email")),
              password: String(f.get("password")),
            });
            if (r.error) throw r.error;
            window.location.assign(next);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-in failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button variant="brand" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <Link to="/forgot-password" className="block text-center text-sm text-sky">
          Forgot password?
        </Link>
      </form>
      <PaytmSignInButton />
      <p className="mt-5 text-center text-sm text-muted-foreground">
        New to payIQ?{" "}
        <Link to="/register" search={{ next }} className="font-semibold text-sky">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
