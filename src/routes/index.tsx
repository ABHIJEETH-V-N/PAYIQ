import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/app/LoginForm";
import { seo } from "@/lib/seo";
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s["next"] === "string" ? { next: s["next"] } : {},
  head: () =>
    seo("Sign in — payIQ", "Sign in to payIQ to manage your saved payments and business details."),
  component: LoginForm,
});
