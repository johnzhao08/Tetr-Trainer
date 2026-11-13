import { useEffect, useRef } from "react";

const SEEN_KEY = "tetr-trainer.lst-intro-seen";

// Shown automatically the first time the LST module opens.
export function lstIntroSeen(storage: Pick<Storage, "getItem">) {
  try {
    return storage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
export function markLstIntroSeen(storage: Pick<Storage, "setItem">) {
  try {
    storage.setItem(SEEN_KEY, "1");
  } catch {
    // Private mode or blocked storage: the note simply shows again next time.
  }
}

export function LstIntroDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog lst-intro"
      aria-labelledby="lst-intro-title"
      data-game-input="ignore"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id="lst-intro-title">Strict LST isn't always sustainable</h2>
          <p>
            Strict LST means a T-spin double in the well with every T, Quads as
            the only other clears, and no stray holes. A computer search found
            no way to keep that up against every bag order, even with five
            previews.
          </p>
        </div>
      </div>
      <div className="lst-intro-body">
        <h3>Where it breaks</h3>
        <p>
          A bag deals its T before a slot is ready, so the T goes to hold. If
          the next bag deals its T early too, there isn't enough material to
          build another slot in time, and that T has nowhere to go.
        </p>
        <h3>What the solver does</h3>
        <ul>
          <li>Warns you when a T sits in hold with no double ready.</li>
          <li>Flags suggestions that end in that state.</li>
          <li>
            Keeps recovery moves available, like a T outside the well or a
            non-LST clear, and marks lines that leave the LST shape as recovery
            lines.
          </li>
        </ul>
        <p>
          Treat strict LST as the target, not a guarantee: when the queue
          turns against you, a clean recovery beats a buried T.
        </p>
        <p className="lst-intro-note">
          The search checked bag-by-bag plans that keep the LST shape. It is
          strong evidence, not a proof. Details are in LST_RESEARCH.md.
        </p>
      </div>
      <div className="dialog-footer">
        <span />
        <button className="primary-button" type="button" onClick={onClose}>
          Got it
        </button>
      </div>
    </dialog>
  );
}
