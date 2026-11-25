import { useRef, useState } from "react";
import {
  emptyProgress,
  exportProgress,
  importProgressCounted,
} from "../core/progress";
import type { Progress } from "../core/progress";
import { writeProgress } from "./progressStorage";

type Message = { kind: "ok" | "error"; text: string } | null;

// Export, import and reset for the saved drill history.
export function DataSection({
  progress,
  onChange,
}: {
  progress: Progress;
  onChange: (next: Progress) => void;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [confirming, setConfirming] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const count = progress.sessions.length;

  const apply = (next: Progress, okText: string) => {
    onChange(next);
    const saved = writeProgress(next);
    setMessage({
      kind: saved ? "ok" : "error",
      text: saved ? okText : "Browser storage is unavailable, so this is not saved.",
    });
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([exportProgress(progress)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "tetr-trainer-progress.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: "ok", text: "Progress downloaded." });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportProgress(progress));
      setMessage({ kind: "ok", text: "Progress copied to the clipboard." });
    } catch {
      setMessage({ kind: "error", text: "Copy failed. Use Download instead." });
    }
  };
  const doImport = (source: string) => {
    const result = importProgressCounted(source);
    if (!result) {
      setMessage({
        kind: "error",
        text: "That is not valid progress data, or none of its sessions were valid. Nothing was changed.",
      });
      return;
    }
    setText("");
    const { accepted, skipped, trimmed } = result;
    apply(
      result.progress,
      `Imported ${accepted} ${accepted === 1 ? "session" : "sessions"}, replacing your saved progress.` +
        (skipped > 0
          ? ` Skipped ${skipped} invalid or duplicate ${skipped === 1 ? "record" : "records"}.`
          : "") +
        (trimmed > 0
          ? ` Dropped ${trimmed} older ${trimmed === 1 ? "session" : "sessions"} past the storage limit.`
          : ""),
    );
  };
  const onFile = async (picked: File | undefined) => {
    if (!picked) return;
    try {
      doImport(await picked.text());
    } catch {
      setMessage({
        kind: "error",
        text: "Could not read that file. Nothing was changed.",
      });
    } finally {
      if (file.current) file.current.value = "";
    }
  };

  return (
    <section className="data-section" aria-labelledby="data-title">
      <div className="level-heading">
        <h2 id="data-title">Your data</h2>
        <p>
          {count} saved {count === 1 ? "session" : "sessions"}, kept in this
          browser only.
        </p>
      </div>
      <div className="data-actions">
        <button className="button" onClick={download} disabled={count === 0}>
          Download JSON
        </button>
        <button className="button" onClick={copy} disabled={count === 0}>
          Copy to clipboard
        </button>
        <button className="button" onClick={() => file.current?.click()}>
          Import file
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="Progress file"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      <label className="data-paste">
        <span>Or paste exported progress</span>
        <textarea
          value={text}
          rows={3}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="data-actions">
        <button
          className="button"
          disabled={text.trim() === ""}
          onClick={() => doImport(text)}
        >
          Import pasted data
        </button>
        {confirming ? (
          <>
            <span>Delete all saved progress?</span>
            <button
              className="button danger"
              onClick={() => {
                setConfirming(false);
                apply(emptyProgress(), "Progress reset.");
              }}
            >
              Yes, reset
            </button>
            <button className="button quiet" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            className="button quiet"
            disabled={count === 0}
            onClick={() => setConfirming(true)}
          >
            Reset progress
          </button>
        )}
      </div>
      <p
        className={message?.kind === "error" ? "data-message error" : "data-message"}
        role={message?.kind === "error" ? "alert" : "status"}
      >
        {message?.text}
      </p>
    </section>
  );
}
