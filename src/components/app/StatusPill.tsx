import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  SUCCESS: "bg-success/12 text-success",
  ACTIVE: "bg-success/12 text-success",
  INDEXED: "bg-success/12 text-success",
  RETRYING: "bg-warning/20 text-warning-foreground",
  RETRYING_1_OF_2: "bg-warning/20 text-warning-foreground",
  PROCESSING: "bg-accent text-accent-foreground",
  AWAITING_USER_AUTH: "bg-accent text-accent-foreground",
  FAILED: "bg-destructive/12 text-destructive",
};
const label: Record<string, string> = { RETRYING_1_OF_2: "Retrying 1/2", AWAITING_USER_AUTH: "Awaiting Approval" };

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide", map[status] ?? "bg-muted text-muted-foreground")}>
      <span className="size-1.5 rounded-full bg-current" />
      {label[status] ?? status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
