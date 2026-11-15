import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout, Field } from "@/components/app/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";
export const Route = createFileRoute("/forgot-password")({
  head: () =>
    seo("Forgot password — payIQ", "Request a secure password reset link for your payIQ account."),
  component: Forgot,
});
function Forgot() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout title="Reset your password" subtitle="We’ll send a reset link to your email.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          const r = await supabase.auth.resetPasswordForEmail(String(f.get("email")), {
            redirectTo: window.location.origin + "/reset-password",
          });
          setMessage(
            r.error ? r.error.message : "If an account exists, check your email for a reset link.",
          );
          setBusy(false);
        }}
      >
        <Field label="Email" name="email" type="email" required />
        <Button variant="brand" className="w-full" disabled={busy}>
          Send reset link
        </Button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        <Link to="/" className="block text-sm text-sky">
          Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
}
