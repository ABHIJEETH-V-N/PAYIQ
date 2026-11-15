export type SmartEmail = {
  senderName: string; senderEmail: string; transferName: string; amount: string;
  cap: string | null; direction: "Collect" | "Pay out"; schedule: string; policy: string;
  retries: number; status: string; badge: string; summary: string;
};
export function smartEmailPresentation(title: string, status: string, direction: "Collect" | "Pay out", sender: string) {
  if (/reminder/i.test(title)) return { badge: "Payment Reminder", summary: `${sender} has sent a reminder for this Smart Transfer.` };
  if (/retry|fail/i.test(title) || status === "FAILED") return { badge: "Retry / Failure Notice", summary: "This Smart Transfer needs attention. Check the current status and retry details in payIQ." };
  if (status === "SUCCESS" || status === "COMPLETED") return direction === "Pay out"
    ? { badge: "Payout Sent", summary: "Your Smart Transfer payout has been processed using simulated funds." }
    : { badge: "Collection Completed", summary: "This Smart Transfer collection has been accepted and settled using simulated funds." };
  if (status === "CANCELLED") return { badge: "Request Declined", summary: "This Smart Transfer was declined or cancelled. No funds were moved by this action." };
  return direction === "Collect"
    ? { badge: "Collection Request", summary: `${sender} has requested a Smart Transfer payment.${status === "DRAFT" ? " This is a saved draft; no payment has been made." : " Log in to review and tap Accept & Pay."}` }
    : { badge: "Payout Request", summary: `${sender} has prepared a Smart Transfer payout. Review its current status in payIQ.` };
}