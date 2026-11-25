import type { Metronome as MetronomeSettings } from "../core/settings";

/** Pieces in one bag; the accent marks the start of each. */
export const ACCENT_EVERY = 7;
const LOOKAHEAD_S = 0.12;
const POLL_MS = 30;

export type Beat = { at: number; index: number };

/**
 * Beats still to be scheduled: those due before `now + lookahead`, starting
 * at `next` (the time of beat `index`). Beats before `now` are skipped but
 * still advance the index, so the accent stays on the bag boundary. Pure, so the schedule is testable.
 */
export function dueBeats(
  next: number,
  index: number,
  now: number,
  lookahead: number,
  pps: number,
): { beats: Beat[]; next: number; index: number } {
  const interval = 1 / pps;
  const beats: Beat[] = [];
  while (next < now + lookahead) {
    // A beat that already passed (a late poll) is skipped, not burst out.
    if (next >= now) beats.push({ at: next, index });
    next += interval;
    index++;
  }
  return { beats, next, index };
}

type AudioLike = Pick<
  AudioContext,
  "currentTime" | "destination" | "createOscillator" | "createGain" | "state" | "resume" | "close"
>;

/** A soft WebAudio click per piece interval. No audio files. */
export class Metronome {
  private ctx: AudioLike | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private index = 0;
  private pps = 1;
  private volume = 0.5;
  private accent = true;
  // Clicks scheduled but not yet finished, so stop can silence them.
  private live = new Set<{ osc: OscillatorNode; gain: GainNode; end: number }>();

  constructor(private readonly makeContext: () => AudioLike = defaultContext) {}

  get running() {
    return this.timer !== null;
  }

  /** Start, or retune a running metronome without restarting the beat. */
  start(config: Pick<MetronomeSettings, "volume" | "accent"> & { pps: number }) {
    this.pps = config.pps;
    this.volume = config.volume;
    this.accent = config.accent;
    if (this.timer) return;
    try {
      this.ctx ??= this.makeContext();
      void this.ctx.resume();
    } catch {
      return; // Audio unavailable: stay silent.
    }
    this.next = this.ctx.currentTime + 0.05;
    this.index = 0;
    this.timer = setInterval(() => this.schedule(), POLL_MS);
    this.schedule();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const { osc, gain } of this.live) {
      try {
        osc.stop();
      } catch {
        // Never started or already ended.
      }
      osc.disconnect();
      gain.disconnect();
    }
    this.live.clear();
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const due = dueBeats(this.next, this.index, ctx.currentTime, LOOKAHEAD_S, this.pps);
    this.next = due.next;
    this.index = due.index;
    for (const beat of due.beats) this.click(ctx, beat);
  }

  private click(ctx: AudioLike, { at, index }: Beat) {
    if (this.volume <= 0) return;
    const strong = this.accent && index % ACCENT_EVERY === 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = strong ? 1320 : 880;
    // A 40 ms sine blip with a fast decay stays soft, never a harsh tick.
    const peak = this.volume * (strong ? 0.5 : 0.3);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.05);
    for (const c of this.live) if (c.end < ctx.currentTime) this.live.delete(c);
    this.live.add({ osc, gain, end: at + 0.05 });
  }
}

function defaultContext(): AudioLike {
  return new AudioContext();
}
