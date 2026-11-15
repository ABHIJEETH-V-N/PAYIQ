export async function sarvamRequest(path: string, key: string, body: BodyInit, json = false) {
  const response = await fetch(`https://api.sarvam.ai${path}`, {
    method: "POST",
    headers: {
      "api-subscription-key": key,
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body,
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    // Do not log provider bodies: they may echo private requests or credentials.
    console.error("Sarvam request failed", response.status);
    if (response.status === 401 || response.status === 403)
      throw new Error("Sarvam could not authenticate. Check the saved Sarvam API key.");
    if (response.status === 402)
      throw new Error("Sarvam needs credits. Check your Sarvam billing balance.");
    if (response.status === 429) throw new Error("Sarvam is busy. Please try again shortly.");
    throw new Error(
      `Sarvam could not process this request (${response.status}). Please try again.`,
    );
  }
  return response.json();
}
