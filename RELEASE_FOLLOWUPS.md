# Release follow-ups (Simplify for Me)

Recorded during the production-build release check. Not blocking acceptance.

## 1. Non-atomic LLM availability and monitoring

Edge non-atomic path often returns `reason: llm_unavailable` and falls back to shared rules. Follow up: confirm OpenAI secrets/runtime, add monitoring/alerts for LLM fail rates, and verify timeouts vs rate limits.

## 2. Eliminate client/edge dual-core drift

`src/app/data/simplifyTaskCore.ts` and `supabase/functions/server/simplifyTaskCore.ts` are duplicated and must stay hash-identical. Follow up: share one source of truth (build-time copy or imported package) without a redesign in this release.

## 3. Answer-usage attestation quality

Some answers that clearly shape suggestions can still be under-marked (`irrelevant` / `not_applicable`) while the labels/how-to already reflect them (example: advisor “what to say” / short script). Follow up: tighten attestation mapping without changing the response contract.
