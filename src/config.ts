import "dotenv/config";
import { LLM_ENV, resolveLlmConfig, type LlmConfig } from "@meirakrish/llm-kit";
import { z } from "zod";

const ConfigSchema = z.object({
  KUBECONFIG: z.string().optional(),
  MAX_STEPS_PER_PROBLEM: z.coerce.number().int().positive().default(6),
  RESTART_THRESHOLD: z.coerce.number().int().positive().default(5),
  EVENT_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),
  MAX_PROBLEMS: z.coerce.number().int().positive().default(5),
  TOOL_OUTPUT_MAX_CHARS: z.coerce.number().int().min(500).default(4000),
});

/**
 * The agent's prompts and tool loop are tuned for this model. It is the default when Ollama is the provider
 * and LLM_MODEL is not set; hosted providers use llm-kit's defaults.
 */
export const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b-instruct";

/** Pre-llm-kit names of the shared LLM settings, still read with a deprecation warning. Remove in 1.0. */
export const LEGACY_LLM_ENV: Record<string, string> = {
  OLLAMA_URL: LLM_ENV.ollamaHost,
  MODEL: LLM_ENV.model,
  NUM_CTX: LLM_ENV.numCtx,
};

export interface Config {
  /** Provider, model and limits (llm-kit's shared LLM_* settings). */
  llm: LlmConfig;
  /** Undefined uses $KUBECONFIG, then ~/.kube/config. */
  kubeconfigPath?: string;
  /** Max tool calls per investigated problem. */
  maxStepsPerProblem: number;
  /** Containers restarting at least this often are flagged. */
  restartThreshold: number;
  /** How far back warning events, restarts and probe failures count as recent. */
  eventWindowMinutes: number;
  /** Max problems the LLM investigates per run. */
  maxProblems: number;
  /** Tool outputs longer than this are truncated before they reach the LLM. */
  toolOutputMaxChars: number;
}

type Env = Record<string, string | undefined>;

export function loadConfig(
  env: Env = process.env,
  warn: (msg: string) => void = (msg) => console.error(`Warning: ${msg}`),
): Config {
  // Empty values in .env (e.g. `KUBECONFIG=`) mean "not set", so defaults apply.
  const nonEmpty = Object.fromEntries(
    Object.entries(env).filter((e): e is [string, string] => e[1] !== undefined && e[1].trim() !== ""),
  );
  const parsed = ConfigSchema.safeParse(nonEmpty);
  if (!parsed.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const c = parsed.data;
  return {
    llm: loadLlmConfig(withLegacyEnv(nonEmpty, warn)),
    kubeconfigPath: c.KUBECONFIG,
    maxStepsPerProblem: c.MAX_STEPS_PER_PROBLEM,
    restartThreshold: c.RESTART_THRESHOLD,
    eventWindowMinutes: c.EVENT_WINDOW_MINUTES,
    maxProblems: c.MAX_PROBLEMS,
    toolOutputMaxChars: c.TOOL_OUTPUT_MAX_CHARS,
  };
}

/**
 * Cluster data stays on this machine unless a hosted provider is chosen explicitly with LLM_PROVIDER.
 * Unlike llm-kit's default, a stray ANTHROPIC_API_KEY or OPENAI_API_KEY in the shell does not switch providers.
 */
function loadLlmConfig(env: Env): LlmConfig {
  const provider = env[LLM_ENV.provider] ?? "ollama";
  const model = env[LLM_ENV.model] ?? (provider.toLowerCase() === "ollama" ? DEFAULT_OLLAMA_MODEL : undefined);
  return resolveLlmConfig({ provider, model }, env);
}

function withLegacyEnv(env: Env, warn: (msg: string) => void): Env {
  const out = { ...env };
  for (const [legacy, current] of Object.entries(LEGACY_LLM_ENV)) {
    if (!env[legacy] || env[current]) continue;
    warn(`${legacy} is deprecated; use ${current}`);
    out[current] = env[legacy];
  }
  return out;
}
