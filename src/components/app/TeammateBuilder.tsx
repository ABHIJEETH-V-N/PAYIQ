import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Bot, Check, Minus, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  builderQuestions,
  redactTeamText,
  teamSpecSchema,
  type TeamSpec,
} from "@/lib/teams-validation";
import { createTeammate, proposeTeammate, saveBuilderDraft } from "@/lib/teams.functions";
import { useTeams } from "@/lib/teams";
import { toast } from "sonner";

export function TeammateBuilder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { draft } = useTeams();
  const value =
    draft?.data && typeof draft.data === "object" && !Array.isArray(draft.data) ? draft.data : {};
  const [answers, setAnswers] = useState<string[]>(
    Array.isArray(value["answers"])
      ? value["answers"].filter((a): a is string => typeof a === "string")
      : [],
  );
  const [draftId, setDraftId] = useState(draft?.id);
  const [spec, setSpec] = useState<TeamSpec | null>(() => {
    const saved = teamSpecSchema.safeParse(value["spec"]);
    return saved.success ? saved.data : null;
  });
  const [reply, setReply] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = useServerFn(saveBuilderDraft);
  const propose = useServerFn(proposeTeammate);
  const create = useServerFn(createTeammate);
  const qc = useQueryClient();
  const step = builderQuestions[answers.length];
  async function persist(next: string[], nextSpec?: TeamSpec) {
    const saved = await save({ data: { id: draftId, answers: next, spec: nextSpec } });
    setDraftId(saved.id);
  }
  async function answer(text: string) {
    if (!text.trim() || busy) return;
    const safe = redactTeamText(text.trim());
    if (safe !== text.trim()) {
      setInput(safe);
      setError(
        "Sensitive information was removed. Do not share passwords, OTPs or personal identifiers in chat.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const next = [...answers, safe];
    try {
      await persist(next);
      setAnswers(next);
      setInput("");
      if (next.length === builderQuestions.length) {
        const proposal = await propose({ data: next });
        setSpec(proposal.spec);
        setReply(proposal.reply);
        await persist(next, proposal.spec);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }
  async function minimise() {
    try {
      await persist(answers, spec ?? undefined);
      await qc.invalidateQueries({ queryKey: ["teams"] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save draft.");
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) void minimise();
      }}
    >
      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 p-0 sm:h-[min(800px,90dvh)] sm:max-w-[680px]">
        <header className="border-b px-5 py-5 pr-14">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
              <Bot />
            </span>
            <div>
              <DialogTitle>Teammate builder</DialogTitle>
              <DialogDescription className="mt-1">IQ · New teammate</DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              title="Minimise builder"
              aria-label="Minimise builder"
              disabled={busy}
              onClick={() => void minimise()}
            >
              <Minus />
            </Button>
          </div>
          <ol className="mt-5 flex justify-between gap-1 text-[10px] sm:text-xs">
            {["Purpose", "Systems", "Documents", "Permissions", "Review"].map((label, i) => (
              <li
                key={label}
                className={
                  i <= Math.floor(answers.length / 2)
                    ? "text-accent-foreground"
                    : "text-muted-foreground"
                }
              >
                {label}
              </li>
            ))}
          </ol>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {answers.map((a, i) => (
            <div key={builderQuestions[i]?.key} className="space-y-2">
              <p className="max-w-[90%] rounded-lg glass px-4 py-3 text-sm">
                {builderQuestions[i]?.question}
              </p>
              <p className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-secondary px-4 py-3 text-sm">
                {a}
              </p>
            </div>
          ))}
          {step && (
            <>
              <p className="max-w-[90%] rounded-lg glass px-4 py-3 text-sm">{step.question}</p>
              <div className="flex flex-wrap gap-2">
                {step.chips.map((chip) => (
                  <Button
                    key={chip}
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void answer(chip)}
                  >
                    {chip}
                  </Button>
                ))}
              </div>
            </>
          )}
          {busy && (
            <p role="status" className="text-sm text-muted-foreground">
              Preparing your teammate…
            </p>
          )}
          {!step && !spec && !busy && (
            <Button
              variant="outline"
              onClick={async () => {
                setBusy(true);
                try {
                  const p = await propose({ data: answers });
                  setSpec(p.spec);
                  setReply(p.reply);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not prepare profile.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Prepare reviewed profile
            </Button>
          )}
          {spec && (
            <div className="space-y-4">
              <p className="whitespace-pre-wrap text-sm">{reply}</p>
              <h3 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-4 text-sky" /> Review teammate
              </h3>
              <label className="block text-sm">
                Name
                <input
                  aria-label="Teammate name"
                  className="mt-1 h-11 w-full rounded-lg border bg-background px-3"
                  value={spec.name}
                  maxLength={80}
                  onChange={(e) => setSpec({ ...spec, name: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                Goal
                <textarea
                  aria-label="Teammate goal"
                  className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3"
                  value={spec.goal}
                  maxLength={2000}
                  onChange={(e) => setSpec({ ...spec, goal: e.target.value })}
                />
              </label>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>{spec.role}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Audience</dt>
                  <dd>{spec.audience}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Channels</dt>
                  <dd>{spec.channels.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Suggested review threshold</dt>
                  <dd>₹{spec.proposed_limit_paise / 100}</dd>
                </div>
              </dl>
              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold">Knowledge needed</h4>
                {spec.documents_needed.map((doc) => (
                  <div key={doc.name} className="mt-2 text-sm">
                    <p>
                      {doc.name} · {doc.required ? "Required" : "Optional"}
                    </p>
                    <p className="text-xs text-muted-foreground">{doc.purpose}</p>
                  </div>
                ))}
              </div>
              {spec.connections_needed.length > 0 && (
                <p className="text-sm text-warning-foreground">
                  External connection verification is not available yet. This teammate will remain
                  in setup.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                No access is granted yet. Policies come next. Attach them from the teammate’s
                Policies tab.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="brand"
                  disabled={busy || !spec.name.trim() || !spec.goal.trim()}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await create({ data: spec });
                      await qc.invalidateQueries({ queryKey: ["teams"] });
                      setAnswers([]);
                      setSpec(null);
                      setDraftId(undefined);
                      toast.success("Teammate created. Attach policies to activate.");
                      onClose();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not create teammate.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Check />
                  Create teammate
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => void minimise()}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        {step && (
          <form
            className="flex items-end gap-2 border-t bg-background p-4 pb-[max(env(safe-area-inset-bottom),16px)]"
            onSubmit={(e) => {
              e.preventDefault();
              void answer(input);
            }}
          >
            <textarea
              aria-label="Builder message"
              placeholder="Describe the job…"
              value={input}
              maxLength={2000}
              rows={2}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              className="min-w-0 flex-1 resize-none rounded-lg border bg-secondary px-3 py-2 text-sm"
            />
            <Button
              aria-label="Send builder answer"
              title="Send answer"
              variant="brand"
              size="icon"
              disabled={busy || !input.trim()}
            >
              <ArrowUp />
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
