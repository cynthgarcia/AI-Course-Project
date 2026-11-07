// Static guardrails: the MVP must not contain calendar writes, purchases or messaging.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../../..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === "__tests__" ? [] : files(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

const FORBIDDEN = [
  /auth\/calendar["'`]/, // full read-write calendar scope
  /auth\/calendar\.events(?!\.readonly)/,
  /calendar\/v3\/calendars\/[^"'`]*\/events["'`][^)]*method:\s*["'`](POST|PUT|PATCH|DELETE)/,
  /nodemailer|sendgrid|twilio/i,
  /stripe|checkout\.session/i,
];

describe("MVP guardrails", () => {
  it("contains no calendar writes, payments or automatic messaging", () => {
    for (const f of files(SRC)) {
      const text = readFileSync(f, "utf8");
      for (const re of FORBIDDEN) expect(re.test(text), `${path.relative(SRC, f)} matches ${re}`).toBe(false);
    }
  });
});
