"use client";

import { useId, useState } from "react";
import { draftInvitation } from "@/lib/domain/invitation";
import { canTransition } from "@/lib/domain/status";
import type { CuratorEvent } from "@/lib/domain/types";
import { useStore } from "@/lib/store/AppStore";
import { btn } from "./ui";

/** Editable, copyable draft. Copying never sends anything and never changes status. */
export function InvitationDraft({ event }: { event: CuratorEvent }) {
  const { state, dispatch } = useStore();
  const [text, setText] = useState(() => draftInvitation(event, state.prefs.timezone));
  const [copied, setCopied] = useState<null | "ok" | "fail">(null);
  const [confirming, setConfirming] = useState(false);
  const id = useId();
  const status = state.saved[event.id]?.status ?? null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  };

  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3">
      <h2 id={`${id}-h`} className="font-serif text-xl">
        Invite a friend
      </h2>
      <label htmlFor={id} className="block text-sm text-muted">
        Edit the draft, then copy it into whatever app you use. Nothing is sent from here.
      </label>
      <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full rounded-lg border border-line bg-card p-3 text-sm" />
      {event.isDemo && <p className="text-xs text-warn">This is a sample event — don&rsquo;t send this to anyone as if it were real.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn.secondary} onClick={copy}>
          Copy draft
        </button>
        {canTransition(status, "invited") && !confirming && (
          <button type="button" className={btn.quiet} onClick={() => setConfirming(true)}>
            I&rsquo;ve invited someone
          </button>
        )}
        {confirming && (
          <span className="flex items-center gap-2 text-sm">
            Mark as &ldquo;Invited friends&rdquo;?
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                dispatch({ type: "setStatus", eventId: event.id, category: event.category, status: "invited", at: new Date().toISOString() });
                setConfirming(false);
              }}
            >
              Yes
            </button>
            <button type="button" className={btn.quiet} onClick={() => setConfirming(false)}>
              No
            </button>
          </span>
        )}
      </div>
      <p role="status" className="text-xs text-muted">
        {copied === "ok" && "Copied to your clipboard. Not sent — your status hasn't changed."}
        {copied === "fail" && "Couldn't access the clipboard — select the text and copy it manually."}
      </p>
    </section>
  );
}
