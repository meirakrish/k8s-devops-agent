import { maxSeverity } from "@meirakrish/llm-kit";
import type { Severity } from "./types.js";

/** Sort comparator: most severe first. */
export { compareSeverity } from "@meirakrish/llm-kit";

/** The most severe of `severities`; "low" when empty. */
export function worstSeverity(severities: Severity[]): Severity {
  return maxSeverity(severities);
}
