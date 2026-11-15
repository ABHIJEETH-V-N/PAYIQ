import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthLayout, Field } from "@/components/app/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";
export const Route = createFileRoute("/reset-password")({
  head: () =>
    seo("New password — payIQ", "Set a new password using your secure payIQ recovery link."),
  component: Reset,
});
function Reset() {
  const [valid, setValid] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setValid(hash.get("type") === "recovery");
  }, []);
  return (
    <AuthLayout title="Choose a new password" subtitle="Use your email recovery link to continue.">
      {valid && !done ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (f.get("password") !== f.get("confirm")) {
              setMessage("Passwords do not match");
              return;
            }
            setBusy(true);
            const r = await supabase.auth.updateUser({ password: String(f.get("password")) });
            if (r.error) setMessage(r.error.message);
            else {
              await supabase.auth.signOut();
              setDone(true);
              setMessage("Password updated. Sign in with your new password.");
            }
            setBusy(false);
          }}
        >
          <Field
            label="New password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
          <Field label="Confirm password" name="confirm" type="password" minLength={8} required />
          <Button variant="brand" disabled={busy} className="w-full">
            Update password
          </Button>
        </form>
      ) : (
        <p className="text-sm">{done ? "" : "Open the password reset link from your email."}</p>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      )}
      <Link to="/" className="mt-4 block text-sm text-sky">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
