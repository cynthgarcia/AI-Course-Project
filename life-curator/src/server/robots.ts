// robots.txt check for configured venue pages. Conservative: if robots.txt can't be
// read (other than "not found"), the page is not fetched.
const AGENT = "yourlifecurator";

export function robotsAllows(robots: string, path: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false;
      if (value) current.rules.push({ allow: key === "allow", path: value });
    } else lastWasAgent = false;
  }
  const group = groups.find((g) => g.agents.some((a) => a !== "*" && AGENT.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  const matches = (rule: string) => {
    const re = new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`);
    return re.test(path);
  };
  let best: { allow: boolean; len: number } | null = null;
  for (const r of group.rules) {
    if (matches(r.path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) best = { allow: r.allow, len: r.path.length };
  }
  return best ? best.allow : true;
}
