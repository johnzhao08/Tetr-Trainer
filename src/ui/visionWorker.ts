import { generateQuestion } from "../core/vision";
import type { VisionKind, VisionQuestion } from "../core/vision";

export type WorkerAsk = { id: number; seed: number; kind: VisionKind };
export type WorkerReply = { id: number; question: VisionQuestion | null };

/** Build the question for one ask; null when no candidate verified. */
export function answerAsk({ id, seed, kind }: WorkerAsk): WorkerReply {
  try {
    return { id, question: generateQuestion(seed, kind) };
  } catch {
    return { id, question: null };
  }
}

declare const WorkerGlobalScope: unknown;

// Worker entry; elsewhere there is no worker scope and nothing is attached.
const scope = globalThis as unknown as {
  onmessage: ((e: MessageEvent<WorkerAsk>) => void) | null;
  postMessage(reply: WorkerReply): void;
};
if (typeof WorkerGlobalScope !== "undefined") {
  scope.onmessage = (e) => scope.postMessage(answerAsk(e.data));
}
