import { useRef, useState } from "react";
import { exportBackup, importBackup } from "../core/backup";
import { emptyProgress } from "../core/progress";
import type { Progress } from "../core/progress";
import { emptyTraining, isTrainingEmpty } from "../core/training";
import type { Training } from "../core/training";
import { writeProgress, writeTraining } from "./progressStorage";

type Message = { kind: "ok" | "error"; text: string } | null;

// Export, import and reset for the saved drill history and training data.
export function DataSection({
  progress,
  training,
  onChange,
}: {
  progress: Progress;
  training: Training;
  onChange: (progress: Progress, training: Training) => void;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [confirming, setConfirming] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const count = progress.sessions.length;
  const hasData = count > 0 || !isTrainingEmpty(training);
  const backup = () => exportBackup(progress, training);

  const apply = (next: Progress, nextTraining: Training, okText: string) => {
    onChange(next, nextTraining);
    const saved = writeProgress(next) && writeTraining(nextTraining);
    setMessage({
      kind: saved ? "ok" : "error",
      text: saved ? okText : "Browser storage is unavailable, so this is not saved.",
    });
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([backup()], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "tetr-trainer-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: "ok", text: "Backup downloaded." });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(backup());
      setMessage({ kind: "ok", text: "Backup copied to the clipboard." });
    } catch {
      setMessage({ kind: "error", text: "Copy failed. Use Download instead." });
    }
  };
  const doImport = (source: string) => {
    const result = importBackup(source);
    if (!result) {
      setMessage({
        kind: "error",
        text: "That is not a valid backup, or none of its sessions were valid. Nothing was changed.",
      });
      return;
    }
    setText("");
    const { accepted, skipped, trimmed } = result.progress;
    apply(
      result.progress.progress,
      result.training ?? training,
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
        <button className="button" onClick={download} disabled={!hasData}>
          Download JSON
        </button>
        <button className="button" onClick={copy} disabled={!hasData}>
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
          aria-label="Backup file"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      <label className="data-paste">
        <span>Or paste an exported backup</span>
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
            <span>Delete all saved progress and training?</span>
            <button
              className="button danger"
              onClick={() => {
                setConfirming(false);
                apply(emptyProgress(), emptyTraining(), "Progress reset.");
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
            disabled={!hasData}
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
