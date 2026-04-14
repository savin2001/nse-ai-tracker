/**
 * AI Security Middleware
 * ─────────────────────
 * Protects every code path where user-supplied text could reach Claude.
 *
 * Threats addressed:
 *   1. Prompt injection — user text that tries to override the system prompt
 *   2. Jailbreak patterns — roleplay / DAN / "ignore instructions" attacks
 *   3. Indirect injection — malicious content in third-party data fields that
 *      the API echoes back into a prompt
 *   4. Oversized inputs — token-bomb attacks inflating costs
 *   5. Homoglyph / unicode obfuscation of the above patterns
 */
import { Request, Response, NextFunction } from "express";

// ── Pattern library ───────────────────────────────────────────────────────────

/** Normalise unicode homoglyphs + whitespace before matching. */
function normalise(text: string): string {
  return text
    .normalize("NFKD")                      // decompose homoglyphs
    .replace(/[\u0300-\u036f]/g, "")        // strip combining diacritics
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Prompt-injection / jailbreak patterns.
 * Each pattern is tested against the normalised input.
 * Keep patterns specific enough to avoid false-positives on legitimate text.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // Classic override phrases
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/,
  /disregard\s+(your\s+)?(system\s+)?(prompt|instructions?|rules?)/,
  /forget\s+(everything|all|your\s+instructions?)/,
  /override\s+(your\s+)?(system|instructions?|rules?)/,

  // Role / persona hijacking
  /you\s+are\s+now\s+(a\s+|an\s+)?(dan|jailbreak|unrestricted|evil|unfiltered)/,
  /act\s+as\s+(if\s+you\s+(are|were)\s+)?(a\s+|an\s+)?(dan|jailbreak|unrestricted|evil)/,
  /pretend\s+(you\s+)?(are|have\s+no)\s+(restrictions?|rules?|guidelines?)/,
  /roleplay\s+as\s+(an?\s+)?(evil|unrestricted|unfiltered|uncensored)/,
  /\[?dan\]?\s*[:=]/,                       // [DAN]: or DAN=

  // Instruction injection delimiters
  /\]{1,3}\s*\n+\s*(ignore|new\s+instructions?|system|you\s+are)/,
  /<\s*\/?\s*(system|instructions?|prompt)\s*>/i,
  /---+\s*(new\s+)?(system\s+)?prompt/,

  // Token manipulation
  /\{\{.*?\}\}/,                            // Jinja-style template injection
  /\$\{.*?\}/,                              // JS template injection

  // Exfiltration probes
  /repeat\s+(back|verbatim|exactly)\s+(your\s+)?(system\s+prompt|instructions?)/,
  /what\s+(are|were)\s+your\s+(exact\s+)?(system\s+prompt|initial\s+instructions?)/,
  /show\s+me\s+your\s+(system\s+prompt|instructions?|context)/,
];

/**
 * Fields in request bodies that are user-controlled text and should be scanned.
 * Numeric fields (weight, limit, etc.) do not reach prompts.
 */
const SCANNED_FIELDS = ["ticker", "rationale", "query", "message", "description"];

/** Hard limit on any single user-supplied string field (chars). */
const MAX_FIELD_LENGTH = 512;

// ── Guard functions ───────────────────────────────────────────────────────────

/** Check a single string for injection patterns. Returns the matched pattern or null. */
export function detectInjection(text: string): RegExp | null {
  const norm = normalise(text);
  return INJECTION_PATTERNS.find(p => p.test(norm)) ?? null;
}

/**
 * Sanitise a string so it is safe to interpolate into a Claude prompt.
 * - Truncates to maxLen characters
 * - Removes prompt-delimiter sequences
 * - Escapes angle-brackets (prevents XML/HTML injection into prompts)
 */
export function sanitizeForPrompt(text: string, maxLen = 200): string {
  return text
    .slice(0, maxLen)
    .replace(/<\/?[^>]+>/g, "")              // strip HTML/XML tags
    .replace(/---+/g, "—")                   // collapse horizontal rules
    .replace(/\{\{|\}\}/g, "")              // strip template delimiters
    .replace(/[\x00-\x1f\x7f]/g, " ")       // strip control characters
    .trim();
}

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * promptInjectionGuard — scan every user-supplied text field in POST/PUT bodies.
 * Blocks the request with 400 if an injection pattern is found.
 * Apply BEFORE routes that accept user text.
 */
export function promptInjectionGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) { next(); return; }

  const body = req.body as Record<string, unknown>;
  if (!body || typeof body !== "object") { next(); return; }

  for (const field of SCANNED_FIELDS) {
    const value = body[field];
    if (typeof value !== "string") continue;

    // Length check
    if (value.length > MAX_FIELD_LENGTH) {
      res.status(400).json({
        error:  "Input too long",
        field,
        maxLen: MAX_FIELD_LENGTH,
      });
      return;
    }

    // Injection pattern check
    const match = detectInjection(value);
    if (match) {
      // Log for monitoring (never echo the raw input back to the client)
      console.warn("[ai-security] prompt injection attempt blocked", {
        field,
        pattern: match.source.slice(0, 60),
        ip: req.ip,
        userId: (req as any).user?.id ?? "anonymous",
      });
      res.status(400).json({ error: "Input contains disallowed content" });
      return;
    }
  }

  next();
}

/**
 * validateAiJsonOutput — verify that a string parsed from Claude is valid JSON
 * matching the expected shape before it is stored or returned to clients.
 *
 * @param raw  Raw text from Claude's response
 * @param requiredKeys  Keys that must be present in the parsed object
 * @returns Parsed object or throws
 */
export function validateAiJsonOutput(
  raw: string,
  requiredKeys: string[],
): Record<string, unknown> {
  // Extract JSON — Claude sometimes wraps output in markdown fences
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude response contained no JSON object");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Claude response was not valid JSON");
  }

  const missing = requiredKeys.filter(k => !(k in parsed));
  if (missing.length > 0) {
    throw new Error(`Claude response missing required keys: ${missing.join(", ")}`);
  }

  return parsed;
}

/**
 * scrubPii — remove obvious PII from strings before logging.
 * Covers email addresses, phone numbers, and Kenyan ID patterns.
 */
export function scrubPii(text: string): string {
  return text
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[email]")
    .replace(/(\+?254|0)[17]\d{8}/g, "[phone]")           // Kenyan mobile
    .replace(/\b\d{7,8}\b/g, "[id]");                     // National ID pattern
}
