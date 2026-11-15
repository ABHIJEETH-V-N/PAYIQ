export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-base font-bold">pay<span className="text-sky">IQ</span><sup className="text-[8px]">™</sup></div>
        </div>
      )}
    </div>
  );
}
