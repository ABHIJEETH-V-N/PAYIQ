export type ExportRow = {
  order_id: string;
  from_party: string;
  to_party: string;
  amount: number;
  status: string;
  created_at: string;
  is_simulated?: boolean;
};
export function csvCell(value: unknown) {
  const text = String(value);
  return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
}
export async function createFinanceExport(rows: ExportRow[], format: "PDF" | "CSV") {
  const columns = ["Order", "From", "To", "Amount INR", "Status", "Date", "Mode"];
  const values = rows.map((r) => [
    r.order_id,
    r.from_party,
    r.to_party,
    r.amount.toFixed(2),
    r.status,
    r.created_at,
    r.is_simulated ? "SIMULATED — no real money" : "Recorded",
  ]);
  if (format === "CSV")
    return {
      filename: "payiq-ledger.csv",
      mime: "text/csv",
      text: [columns, ...values].map((r) => r.map(csvCell).join(",")).join("\r\n"),
    };
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  pdf.setFontSize(22);
  pdf.text("payIQ", 14, 20);
  pdf.setFontSize(11);
  pdf.text("Transaction summary / receipt — not a tax invoice", 14, 30);
  let y = 42;
  for (const row of values) {
    const lines = pdf.splitTextToSize(row.join(" | ").replace(/[^\x20-\x7E]/g, " "), 180);
    const height = lines.length * 6 + 6;
    if (y + height > 280) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(lines, 14, y);
    y += height;
  }
  return {
    filename: "payiq-summary.pdf",
    mime: "application/pdf",
    base64: pdf.output("datauristring").split(",")[1] ?? "",
  };
}
export function downloadFinanceExport(result: {
  filename: string;
  mime: string;
  text?: string;
  base64?: string;
}) {
  const data = result.base64
    ? Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))
    : (result.text ?? "");
  const url = URL.createObjectURL(new Blob([data], { type: result.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
