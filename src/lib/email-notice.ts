export function friendlyEmailError(error?: string | null): string {
  const text = error ?? "";
  if (/403/.test(text) && /testing emails|verify a domain/i.test(text)) {
    return "Email not sent: the free email sender can only mail the app owner until a domain is verified.";
  }
  return text ? "The email could not be sent." : "Email could not be sent.";
}
