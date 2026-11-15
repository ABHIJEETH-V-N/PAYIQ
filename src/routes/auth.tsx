import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/app/LoginForm";
import { seo } from "@/lib/seo";
export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  head: () =>
    seo("Account sign-in — payIQ", "Access your private payIQ account and saved payment rules."),
  component: LoginForm,
});
