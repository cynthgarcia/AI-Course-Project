"use client";

import { useEffect, useState } from "react";
import { btn } from "./ui";

type State = "checking" | "unsupported" | "unavailable" | "ios-install" | "off" | "on" | "denied";

function keyBytes(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Turns phone/desktop notifications on or off for this device. */
export function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      const cfg = (await fetch("/api/push/config").then((r) => r.json()).catch(() => null)) as { available?: boolean; publicKey?: string } | null;
      if (!cfg?.available || !cfg.publicKey) return setState("unavailable");
      setPublicKey(cfg.publicKey);
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    if (!publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      setMessage("Notifications couldn't be turned on. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    const r = (await fetch("/api/push/test", { method: "POST" }).then((x) => x.json()).catch(() => null)) as { delivered?: number; error?: string } | null;
    setMessage(r?.delivered ? "Sent — it should appear in a moment." : r?.error ?? "No device received it. Try turning notifications off and on.");
  };

  return (
    <div className="space-y-2 text-sm">
      {state === "checking" && <p className="text-muted">Checking this device…</p>}
      {state === "unsupported" && <p className="text-muted">This browser can&rsquo;t show notifications. Alerts still appear in the app.</p>}
      {state === "unavailable" && <p className="text-muted">Phone notifications aren&rsquo;t set up on the server yet. Alerts still appear here in the app.</p>}
      {state === "ios-install" && (
        <p className="text-muted">
          On iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open Off Hours from your home screen and turn notifications on there.
        </p>
      )}
      {state === "denied" && <p className="text-muted">Notifications are blocked for this site. Allow them in your browser&rsquo;s site settings, then come back.</p>}
      {state === "off" && (
        <button type="button" className={btn.primary} disabled={busy} onClick={enable}>
          Turn on notifications on this device
        </button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ok">Notifications are on for this device.</span>
          <button type="button" className={btn.secondary} onClick={test}>
            Send a test
          </button>
          <button type="button" className={btn.quiet} disabled={busy} onClick={disable}>
            Turn off
          </button>
        </div>
      )}
      {message && <p role="status" className="text-muted">{message}</p>}
    </div>
  );
}
