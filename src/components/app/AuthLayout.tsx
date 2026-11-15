import type { ReactNode } from "react";
import { ShieldCheck, Zap, RotateCcw } from "lucide-react";
import { Logo } from "./Logo";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 size-96 rounded-full bg-sky/40 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <span className="font-display text-lg font-bold">payIQ™</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Your payments, on autopilot.</h2>
          <p className="mt-4 text-primary-foreground/75">An AI teammate that watches your Paytm account, retries failed payments and keeps everyone in the loop.</p>
          <div className="mt-10 space-y-4 text-sm">
            {[[Zap, "Auto collections & vendor payouts"], [RotateCcw, "Smart retries — up to 2 attempts"], [ShieldCheck, "You approve anything sensitive"]].map(([I, t]: any) => (
              <div key={t} className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-primary-foreground/15"><I className="size-4" /></div>{t}</div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-primary-foreground/60">Autonomous finance teammate</div>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md animate-rise">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8 rounded-3xl glass p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input {...props} className="h-12 w-full rounded-2xl border bg-background/80 px-4 text-sm outline-none transition focus:border-sky focus:ring-4 focus:ring-sky/15" />
    </label>
  );
}
