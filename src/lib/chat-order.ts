export function chronologicalMessages<T extends { created_at: string; role: string; id: string }>(messages: T[]): T[] {
  return [...messages].sort((a, b) => {
    const time = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (time) return time;
    if (a.role !== b.role) return a.role === "user" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}