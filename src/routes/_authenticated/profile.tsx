import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  FileImage,
  FileSpreadsheet,
  FileText,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/app/AppShell";
import { StatusPill } from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { saveProfile, registerDocument, removeDocument } from "@/lib/data.functions";
import { accountOptions, useAccount } from "@/lib/account";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () =>
    seo(
      "Profile & Knowledge — payIQ",
      "Your business details and the documents your AI teammate learns from.",
    ),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountOptions),
  component: Profile,
});

const icon = (t: string) => (t === "CSV" ? FileSpreadsheet : t === "Image" ? FileImage : FileText);

function Profile() {
  const account = useAccount();
  const queryClient = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState(account.profile);
  const [edit, setEdit] = useState(false);
  const docs = account.documents.map((d) => ({
    ...d,
    uploaded_at: new Date(d.created_at).toLocaleDateString(),
  }));
  const file = useRef<HTMLInputElement>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["account"] });
  const upload = async (f: File) => {
    setBusy(true);
    const path =
      account.profile.id +
      "/" +
      crypto.randomUUID() +
      "/" +
      f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    try {
      const r = await supabase.storage.from("payiq-documents").upload(path, f);
      if (r.error) throw r.error;
      try {
        await registerDocument({
          data: {
            filename: f.name,
            file_type: f.type.includes("image")
              ? "Image"
              : f.name.endsWith(".csv")
                ? "CSV"
                : f.name.endsWith(".pdf")
                  ? "PDF"
                  : "Note",
            storage_path: path,
            size_bytes: f.size,
          },
        });
      } catch (error) {
        await supabase.storage.from("payiq-documents").remove([path]);
        throw error;
      }
      await refresh();
      toast.success("File uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      await saveProfile({
        data: { name: m.name, phone: m.phone, paytm_number: m.paytm_number, upi_id: m.upi_id },
      });
      await refresh();
      setEdit(false);
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const r = await supabase.auth.signOut();
      if (r.error) throw r.error;
      await nav({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-out failed");
    }
  };

  const fields: ["name" | "email" | "phone" | "paytm_number" | "upi_id", string][] = [
    ["name", "Business name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["paytm_number", "Paytm number"],
    ["upi_id", "UPI ID"],
  ];

  return (
    <AppShell title="Profile" subtitle="Your business details and AI knowledge base.">
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-brand font-display text-xl font-bold text-primary-foreground shadow-brand">
              {m.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{m.name}</h2>
              <p className="truncate text-sm text-muted-foreground">{m.upi_id}</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {fields.map(([k, l]) => (
              <label key={k} className="block">
                <span className="text-xs font-semibold text-muted-foreground">{l}</span>
                {edit && k !== "email" ? (
                  <input
                    value={m[k]}
                    onChange={(e) => setM({ ...m, [k]: e.target.value })}
                    className="mt-1 h-11 w-full rounded-2xl border bg-background px-4 text-sm outline-none focus:border-sky focus:ring-4 focus:ring-sky/15"
                  />
                ) : (
                  <div className="mt-1 text-sm font-medium">{m[k]}</div>
                )}
              </label>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            {edit ? (
              <Button variant="brand" className="flex-1" disabled={busy} onClick={save}>
                Save changes
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" onClick={() => setEdit(true)}>
                <Pencil /> Edit
              </Button>
            )}
            <Button variant="ghost" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
          </div>
        </Panel>

        <Panel className="lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Knowledge base</h2>
              <p className="text-sm text-muted-foreground">
                Bills, rate cards and receipts your AI teammate can read.
              </p>
            </div>
            <Button variant="brand" size="sm" disabled={busy} onClick={() => file.current?.click()}>
              <Plus /> Add
            </Button>
          </div>
          <input
            ref={file}
            type="file"
            hidden
            accept=".pdf,.csv,.txt,image/*"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => file.current?.click()}
            className="mt-4 flex h-auto w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-sky/40 bg-accent/40 p-8 text-center transition hover:bg-accent"
          >
            <UploadCloud className="size-8 text-sky" />
            <span className="text-sm font-semibold">Choose a file to upload</span>
            <span className="text-xs text-muted-foreground">
              PDF, invoices, receipts, CSV or notes
            </span>
          </Button>
          <ul className="mt-4 divide-y">
            {docs.map((d) => {
              const I = icon(d.file_type);
              return (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                    <I className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.file_type} · {d.uploaded_at}
                    </div>
                  </div>
                  <StatusPill status={d.status} />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await removeDocument({ data: d.id });
                        await refresh();
                        toast.success("File deleted");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Delete failed");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Email updates</h2>
        <p className="mt-1 text-sm text-muted-foreground">{account.profile.email}</p>
        <ul className="mt-4 divide-y">
          {account.notifications.map((n) => <li key={n.id} className="flex items-start justify-between gap-4 py-3 text-sm">
            <div className="min-w-0"><p className="font-medium">{n.event_type}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>{n.error && <p className="mt-1 break-words text-xs text-destructive">{n.error}</p>}</div>
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">{n.status === "SENT" ? "Sent" : n.status === "FAILED" ? "Not sent" : "Pending"}</span>
          </li>)}
        </ul>
      </section>
    </AppShell>
  );
}
