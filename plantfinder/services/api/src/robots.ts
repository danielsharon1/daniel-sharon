/**
 * Minimal robots.txt evaluator (RFC 9309): groups by user-agent, Allow/Disallow with "*" and "$",
 * longest match wins, Allow wins ties. Used to verify every adapter path before fetching.
 */
interface Rule {
  allow: boolean;
  pattern: string;
  regex: RegExp;
}

export interface RobotsPolicy {
  isAllowed(path: string): boolean;
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

function normalizePath(path: string): string {
  // Compare in percent-encoded form, as robots.txt paths are typically written.
  try {
    return encodeURI(decodeURI(path));
  } catch {
    return path;
  }
}

export function parseRobots(text: string, userAgent: string): RobotsPolicy {
  const ua = userAgent.toLowerCase();
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (key === "disallow" && value === "") continue; // empty Disallow = allow all
      const pattern = normalizePath(value);
      current.rules.push({ allow: key === "allow", pattern, regex: toRegex(pattern) });
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && ua.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);
  return {
    isAllowed(path: string): boolean {
      const p = normalizePath(path);
      let best: Rule | null = null;
      for (const r of rules) {
        if (!r.regex.test(p)) continue;
        if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
      }
      return best ? best.allow : true;
    }
  };
}
