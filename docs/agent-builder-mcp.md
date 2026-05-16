# Agent Builder and MongoDB MCP Architecture

This document explains how LUCID maps to the Google Cloud Rapid Agent Hackathon requirements: Gemini reasoning, Google Cloud deployment, and partner-tool memory through MongoDB MCP-compatible tooling.

## Agent Mission

LUCID helps a user recover decision-making control before a scammer pushes them into a risky action. The agent does not act on the user's behalf. It analyzes submitted evidence, retrieves similar anonymized patterns, explains risk, and suggests safer next steps.

## Runtime Flow

1. **User submits evidence**
   - Up to five screenshots.
   - Optional suspicious URL.
   - Optional pasted chat, email, SMS, or call transcript.

2. **Gemini multimodal analysis**
   - Extracts visible text and UI context.
   - Identifies sender/recipient direction when possible.
   - Detects pressure tactics and sensitive requests.
   - Returns structured JSON for triage.

3. **Pattern Memory retrieval**
   - LUCID searches MongoDB `patterns` and `cases`.
   - Results are similar anonymized manipulation patterns, not full private chats.

4. **Cognitive triage**
   - Local calibration reduces over-alerting for normal chats, ordinary wallet pages, or incomplete evidence.
   - Strong combinations escalate: impersonation + urgency + link/payment/sensitive-data demand.

5. **User-controlled actions**
   - Safe reply.
   - Evidence summary.
   - Verification steps.
   - Shareable report.
   - Optional anonymized pattern save.

## Google Cloud Components

- **Google Cloud Gemini**: multimodal reasoning for screenshots, URLs, and text.
- **Google Cloud Run**: public deployment target for the LUCID web agent.
- **Google Cloud Build**: Docker-based production build and deployment.
- **Agent Builder / Agent Platform alignment**: the agent workflow is organized as perception, tool retrieval, reasoning, and user-controlled action. The documented tool contract below can be exposed to Agent Builder as MCP tools.

## MongoDB Partner Integration

MongoDB is the Partner track for LUCID.

The current app runtime uses the MongoDB Node.js driver for reliability in Cloud Run. The same collections are MCP-compatible and can be served by MongoDB's official MCP Server for Agent Builder tool access.

Collections:

- `patterns`: curated anonymized scam patterns.
- `cases`: user-confirmed anonymized patterns.
- `feedback`: optional future review signals.

## MCP Tool Contract

### `search_patterns`

Purpose: retrieve similar anonymized scam manipulation patterns before final user guidance.

Input:

```json
{
  "manipulation_chain": ["Urgency", "Suspicious Link"],
  "scenario": "Airline refund phishing"
}
```

Output:

```json
{
  "patterns": [
    {
      "pattern_id": "SEA-AIRLINE-REFUND-001",
      "scenario": "Airline refund phishing",
      "risk_level": "Red",
      "severity": 92,
      "manipulation_chain": ["Support Impersonation", "Urgency", "Suspicious Link", "Financial Request"],
      "phrases": ["refund expires", "verify your bank card", "face scan"],
      "recommended_actions": ["Do not open link", "Verify through official app", "Do not share OTP"]
    }
  ]
}
```

### `save_anonymized_pattern`

Purpose: save a user-confirmed anonymous pattern after explicit consent.

Input:

```json
{
  "scenario": "User-confirmed account verification phishing",
  "language": "en",
  "risk_level": "Red",
  "severity": 90,
  "manipulation_chain": ["Brand Impersonation", "Account Threat", "Urgency", "Suspicious Link"],
  "phrases": ["account suspended soon", "security center", "verify now"],
  "recommended_actions": ["Do not open link", "Verify in official app", "Do not share OTP"]
}
```

Storage policy:

- Save abstracted risk type and manipulation structure.
- Save only short evidence phrases needed for pattern matching.
- Do not save original screenshots.
- Do not save full private chats.
- Do not save names, account numbers, phone numbers, emails, or contact details.

## Demo Evidence

During the hackathon video, show:

1. A low-risk IG scheduling case staying Green.
2. A high-risk refund or fake authority case escalating.
3. MongoDB Pattern Memory returning similar anonymized patterns.
4. Optional anonymized save after the user confirms.

This makes the agentic workflow visible: Gemini perceives, MongoDB memory retrieves, LUCID reasons, and the user controls final action.
