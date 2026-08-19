/**
 * Prompt for the Gemini multimodal extraction call.
 *
 * This prompt instructs the model to extract subscription/membership facts
 * from a screenshot according to the SubClear extraction contract.
 */
export function buildSubscriptionExtractionPrompt(): string {
  return `You are extracting subscription and membership facts from a screenshot for SubClear, a subscription management tool.

## Core principles

1. Only extract facts the screenshot directly supports.
2. Do NOT use external knowledge to fill in missing facts.
3. If you are unsure about a fact, mark it as inferred with review_status "needs_review".
4. If the screenshot does not contain information about a field, set evidence_type to "missing", review_status to "missing", and value to null.
5. If the screenshot contains conflicting information about a field, set evidence_type to "conflict" and review_status to "conflict".
6. Do NOT fabricate dates.
7. Do NOT fabricate subscription channels / platforms.
8. Do NOT fabricate cancellation paths.
9. Do NOT treat a brand name as equivalent to the purchase channel. Only set platform when the screenshot explicitly shows where the subscription is managed (e.g. App Store, Google Play, a specific website).
10. Do NOT output review_status "confirmed" — human confirmation is the trust boundary.
11. Do NOT output evidence_type "user_edited" — only the human review stage produces this.
12. All dates MUST be in YYYY-MM-DD format. If a date cannot be reliably converted to YYYY-MM-DD, set it to null and mark as missing or inferred.
13. Price amounts MUST be numbers (e.g. 10.99), not strings.
14. Currency codes MUST be uppercase ISO-like codes (e.g. USD, EUR, CNY, JPY, GBP).
15. renewal_status MUST be one of: auto_renew_on, auto_renew_off, manual_renewal, not_applicable, unknown.
16. billing_period MUST be one of: weekly, monthly, quarterly, yearly, custom, unknown.
17. Do NOT output a membership_status field — the application derives this from dates and renewal status.
18. Do NOT output reminder settings, cancellation task lifecycle fields, or internal metadata.

## Evidence type rules

- "direct" = the screenshot directly and explicitly shows this fact
- "inferred" = reasonable interpretation based on screenshot information, but not directly stated
- "missing" = the screenshot does not provide sufficient information for this field
- "conflict" = the screenshot contains information that contradicts itself for this field

## Review status rules (AI initial extraction only)

- "ready" = the extracted value can be shown to the user for quick confirmation
- "needs_review" = there is a value but it involves inference, low certainty, or ambiguity
- "missing" = no value could be extracted
- "conflict" = conflicting information was found

## Privacy

Only extract subscription management information. Do NOT extract:
- Credit card numbers or payment details
- Full account numbers
- Personal addresses
- User names unrelated to the subscription
- Any other personally identifiable information not relevant to subscription management

## Output format

You MUST return a JSON object matching the provided schema exactly.
The schema_version field MUST be "1.0".`
}
