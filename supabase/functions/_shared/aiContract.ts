/**
 * Shared behavioural contract for every AI feature.
 *
 * Without this each function carried its own ad-hoc system prompt, so tone,
 * rigour, and safety varied per endpoint and there was no way to tell a good
 * response from a bad one before shipping it to a user.
 *
 * The contract has three parts:
 *   1. House rules every response must obey.
 *   2. A checklist the model must work through, so coverage does not depend on
 *      how the user happened to phrase the question.
 *   3. A response schema, validated server-side, so output is data rather than
 *      prose and a malformed answer can be rejected and retried.
 *
 * This is a financial product: a confident invented number is worse than an
 * admission of ignorance, and most rules below exist to enforce that ordering.
 */

/** Model used where cost matters more than reasoning depth. */
export const MODEL_FAST = Deno.env.get("AI_MODEL_FAST") ?? "gpt-4o-mini";

/**
 * Model for portfolio analysis and the morning brief, where reasoning quality
 * shows. Configurable so the two can be compared on identical prompts without
 * a code change.
 */
export const MODEL_DEEP = Deno.env.get("AI_MODEL_DEEP") ?? "gpt-4o-mini";

/**
 * Non-negotiables. Phrased as hard constraints rather than suggestions because
 * models treat "try to" as optional.
 */
export const HOUSE_RULES = `
NON-NEGOTIABLE RULES:

1. GROUND EVERY CLAIM. Only state a number that appears in the DATA section
   below. Never estimate, recall, or infer a price, market cap, ratio, or
   percentage that was not given to you. Training data is stale and must not be
   used for figures.

2. SAY WHEN YOU DO NOT KNOW. If the data needed to answer is absent, say so
   plainly and name what is missing. An admission is correct; an invented
   figure is a serious failure.

3. NO PRICE PREDICTIONS. Never state or imply where a price will go. You may
   describe drivers, historical base rates supplied to you, scenarios, and
   risks. Phrases like "will rise", "is going to", or "expect it to hit" are
   forbidden.

4. PROBABILITIES MUST BE GIVEN, NOT INVENTED. State a percentage only if it
   appears in the DATA section. You may never compute or estimate one yourself.

5. ALWAYS NAME THE DOWNSIDE. Any observation that reads as positive must be
   accompanied by the corresponding risk.

6. NOT ADVICE. You are not a licensed advisor and must not tell anyone to buy,
   sell, or hold. Explain what the data shows and let the reader decide.

7. BE SPECIFIC TO THIS READER. Reference their actual holdings, weights, and
   cost basis when supplied. Generic commentary that would suit any reader is a
   failed response.
`.trim();

/**
 * Coverage checklist. Without it the model answers only what was literally
 * asked and skips the context that makes an answer useful.
 */
export const ANALYSIS_CHECKLIST = `
WORK THROUGH THESE BEFORE ANSWERING (mention what is relevant, skip what the
data does not cover — do not invent it):

- Position context: size, weight in the portfolio, unrealised gain or loss.
- Concentration: is the portfolio heavily exposed to one name or sector?
- Recent price action: what the supplied moves and ranges show.
- News: any supplied headlines touching these holdings, and what they imply.
- Valuation: only if ratios were supplied.
- Upcoming events: earnings or dividend dates, if supplied.
- Risk: what would have to go wrong, and what the reader is exposed to.
- Data gaps: what you would need to say more.
`.trim();

export const DISCLAIMER =
  "Information and education only. Not investment advice. Figures may be delayed or incomplete.";

export interface ContractOptions {
  /** Who the model is in this endpoint, e.g. "a portfolio analyst". */
  role: string;
  /** JSON shape the response must take. */
  schema: string;
  /** Endpoint-specific instructions layered on top of the shared rules. */
  task: string;
  /** Serialised, already-computed facts. The only figures the model may use. */
  data: string;
  /** Set false for conversational endpoints that stream prose. */
  jsonOnly?: boolean;
}

/** Assembles the full system prompt from the shared contract plus specifics. */
export function buildSystemPrompt(options: ContractOptions): string {
  const parts = [
    `You are YishAI, ${options.role} for UnifiedMarket.`,
    HOUSE_RULES,
    ANALYSIS_CHECKLIST,
    `TASK:\n${options.task.trim()}`,
    `DATA (the only figures you may cite):\n${options.data.trim()}`,
  ];

  if (options.jsonOnly !== false) {
    parts.push(
      `RESPONSE FORMAT:\nReply with JSON only — no markdown fence, no prose ` +
        `outside the object — matching exactly:\n${options.schema.trim()}`,
    );
  }

  return parts.join("\n\n");
}

/**
 * Parses a model response that is supposed to be JSON.
 *
 * Models wrap JSON in prose or a markdown fence often enough that a bare
 * JSON.parse fails on otherwise good answers, so recover the object before
 * giving up.
 */
export function parseJsonResponse<T>(raw: string): T | null {
  if (!raw) return null;

  const attempts = [
    raw,
    raw.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/```[\s\S]*$/, ""),
    raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
  ];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt.trim());
      if (parsed && typeof parsed === "object") return parsed as T;
    } catch {
      // Try the next recovery strategy.
    }
  }

  return null;
}

/**
 * Checks a parsed response against the fields an endpoint promised its callers.
 * Returns the missing keys so the caller can retry or degrade deliberately
 * rather than passing a half-formed object to the UI.
 */
export function missingFields(
  value: Record<string, unknown> | null,
  required: string[],
): string[] {
  if (!value) return required;
  return required.filter((key) => {
    const field = value[key];
    if (field == null) return true;
    if (typeof field === "string" && field.trim() === "") return true;
    if (Array.isArray(field) && field.length === 0) return true;
    return false;
  });
}
