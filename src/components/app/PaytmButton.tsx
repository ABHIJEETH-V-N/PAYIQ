import { Button } from "@/components/ui/button";

export function PaytmSignInButton() {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        variant="outline"
        size="lg"
        className="mt-4 w-full"
        disabled
        title="Paytm sign-in is coming soon"
      >
        <span aria-hidden className="grid size-5 place-items-center rounded-md bg-sky text-[11px] font-bold text-primary-foreground">
          P
        </span>
        Continue with PayTM
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Paytm sign-in is coming soon.</p>
    </div>
  );
}
