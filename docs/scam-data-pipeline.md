# Scam Pattern Data Pipeline

LUCID should learn from scam records without storing private conversations or exposing victims.

## Recommended Source Types

- Official advisories: police, banks, telecoms, embassies, consumer protection agencies.
- Public news reports: summarized cases with no private identifiers.
- User-submitted screenshots: only after manual desensitization.
- Social media posts: use only publicly visible, manually reviewed, anonymized excerpts.

## Do Not Store

- Full private chats.
- Phone numbers, IDs, bank accounts, QR codes, addresses, usernames, avatars, faces.
- Direct links to victims' personal posts unless permission is explicit.
- Screenshots that include unrelated private content.

## Pattern Record Shape

```json
{
  "pattern_id": "CN-EMBASSY-001",
  "source_type": "official | news | social | user_submitted",
  "source_note": "brief source label, no private URL if sensitive",
  "language": "zh-CN",
  "scenario": "Fake embassy / police scam",
  "manipulation_chain": ["Authority", "Fear", "Isolation", "Urgency", "Financial Demand"],
  "phrases": ["不要告诉任何人", "你涉嫌诈骗", "马上转账"],
  "risk_level": "Red",
  "severity": 95,
  "recommended_actions": ["Pause", "Tell a trusted person", "Verify official channel"]
}
```

## Xiaohongshu / Social Platform Rule

Use a manual or permission-based workflow first:

1. Collect candidate posts manually or from exported links.
2. Rewrite into anonymized pattern records.
3. Store only tactic phrases and scenario summaries.
4. Do not publish raw screenshots without desensitization.

Avoid aggressive crawling, login scraping, or bypassing platform protections. The goal is a pattern memory library, not a copy of social posts.

## MVP Import Flow

1. Prepare a JSON file of anonymized patterns.
2. Review for privacy.
3. Import into MongoDB `patterns`.
4. Show only pattern IDs and scenario names in the app.
