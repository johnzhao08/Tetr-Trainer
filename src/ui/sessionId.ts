// Session ids for saved drill runs. Lives in the UI layer because it reads
// browser randomness and the clock, which src/core must not use.
export function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
