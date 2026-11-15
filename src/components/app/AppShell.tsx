import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Sparkles,
  RefreshCw,
  BookOpenText,
  Wallet,
  Users,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { NotificationsBell } from "./NotificationsBell";
import { Logo } from "./Logo";
import { useAccount } from "@/lib/account";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const tabs = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/workspace", label: "IQ", icon: Sparkles },
  { to: "/sync-requests", label: "Smart Transfers", icon: RefreshCw },
  { to: "/ledger", label: "Ledger", icon: BookOpenText },
  { to: "/wallet", label: "Wallet", icon: Wallet },
] as const;

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const merchant = useAccount().profile;
  const initials = merchant.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-screen w-64 shrink-0 flex-col gap-8 border-r bg-sidebar px-5 py-6 backdrop-blur-xl">
        <Logo />
        <nav className="flex flex-col gap-1">
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground",
                path.startsWith(to) &&
                  "bg-primary text-primary-foreground shadow-brand hover:bg-primary hover:text-primary-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <Link
          to="/teams"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
            path.startsWith("/teams")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-secondary",
          )}
        >
          <Users className="size-4" />
          Teams
        </Link>
        <Link to="/profile" className="mt-auto flex items-center gap-3 rounded-2xl glass p-3">
          <div className="grid size-9 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0 text-sm">
            <div className="truncate font-semibold">{merchant.name}</div>
            <div className="truncate text-xs text-muted-foreground">{merchant.upi_id}</div>
          </div>
        </Link>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="hidden lg:block text-sm text-muted-foreground">{merchant.name}</div>
            <div className="flex items-center gap-2">
              <NotificationsBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="brand"
                    size="icon"
                    aria-label="Account menu"
                    className="rounded-full"
                  >
                    {initials}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <UserRound />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/teams">
                      <Users />
                      Teams
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 md:px-8 lg:pb-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-rise">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {action}
          </div>
          {children}
        </main>
      </div>

      {/* Mobile / tablet bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1 rounded-3xl glass p-1.5">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium text-muted-foreground transition",
                  active && "bg-primary text-primary-foreground shadow-brand",
                )}
              >
                <Icon className="size-5" />
                <span className="text-center leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-3xl glass p-5 animate-rise", className)}>{children}</section>
  );
}
