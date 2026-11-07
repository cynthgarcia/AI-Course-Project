import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "ok" | "warn" | "bad" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-line/60 text-ink",
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-50",
  secondary: "inline-flex items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:border-ink disabled:opacity-50",
  quiet: "inline-flex items-center justify-center rounded-full px-3 py-2 text-sm text-muted hover:text-ink disabled:opacity-50",
  accent: "inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50",
};

export function SectionHeading({ id, kicker, children, aside }: { id?: string; kicker?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {kicker && <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{kicker}</p>}
        <h2 id={id} className="font-serif text-2xl leading-tight">
          {children}
        </h2>
      </div>
      {aside}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-6 text-center">
      <p className="font-serif text-lg">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`rounded-lg px-3 py-2 text-sm ${TONES[tone]}`}>{children}</div>;
}
