# Devpost Draft

## Project Title

LUCID - Cognitive Safety Agent for Scam-Resistant Decisions

## Tagline

A cognitive safety agent that helps people pause, understand scam pressure, and choose safer next actions before panic-driven harm happens.

## Project Description

LUCID is built for the moment when a person receives a frightening message, call, or website and feels too scared to ask someone else. It analyzes user-submitted screenshots, URLs, call transcripts, and messages to detect manipulation chains such as fear, urgency, authority impersonation, isolation, suspicious links, fake rewards, and sensitive-data demands.

Instead of simply saying "scam" or "not scam," LUCID first helps the user slow down. It then explains what increased the risk, retrieves similar anonymized scam patterns from MongoDB Pattern Memory, generates safer next actions, and creates a report the user can share with someone they trust.

## Inspiration

The project was inspired by real scam patterns across Southeast Asia: fake police or embassy threats, airline refund phishing, WhatsApp account-verification messages, and crypto investment pressure. These scams often work not because the victim is careless, but because the scammer controls the emotional environment: do not tell anyone, do not search online, act now, transfer money, verify your account, or you will be punished.

LUCID is designed around that insight: the scam begins before the payment. It begins when judgment is manipulated.

## What It Does

- Accepts up to five screenshots plus optional URL or text context.
- Supports chats, websites, SMS, email, call transcripts, and suspicious links.
- Uses Gemini to extract visual and textual evidence.
- Detects manipulation tactics and assigns Green, Yellow, Orange, or Red triage.
- Shows explainable risk scoring and emotional pressure signals.
- Retrieves similar anonymized patterns from MongoDB Pattern Memory.
- Generates safe replies, evidence summaries, verification steps, and shareable reports.
- Lets users optionally save an anonymized pattern to help future users.

## How We Built It

LUCID is a Next.js and TypeScript application deployed on Google Cloud Run. Gemini performs multimodal scam and manipulation analysis over screenshots, URLs, and text. MongoDB Atlas stores anonymized Pattern Memory collections.

The agent workflow is:

1. Perceive user-submitted evidence with Gemini.
2. Retrieve similar anonymized patterns from MongoDB Pattern Memory.
3. Reason over manipulation chains and risk evidence.
4. Triage the case into Green, Yellow, Orange, or Red.
5. Generate user-controlled safety actions, safe replies, evidence summaries, and reports.
6. Save an anonymized pattern only if the user explicitly confirms.

## Partner Integration: MongoDB

LUCID uses MongoDB as the agent's Pattern Memory layer. The app stores and retrieves anonymized scam patterns such as fake authority threats, airline refund phishing, account-verification phishing, and investment-pressure pages.

For the hackathon partner integration, the MongoDB collections are mapped to MCP-compatible tools:

- `search_patterns`: searches `patterns` and `cases` for similar manipulation chains.
- `save_anonymized_pattern`: saves only abstracted risk type, manipulation chain, evidence phrases, and recommended actions after user confirmation.

The production app uses the MongoDB Node.js driver for reliability, while the architecture and demo present MongoDB Pattern Memory as the partner tool layer that supports agent reasoning.

## What Makes It Agentic

LUCID is not just a classifier. It performs a multi-step, tool-using safety workflow:

- It perceives evidence.
- It retrieves memory.
- It reasons about manipulation chains.
- It decides whether to escalate protective guidance.
- It prepares safe next actions.
- It asks for user confirmation before saving anything.

The user remains in control throughout the process.

## Privacy and Safety

LUCID only analyzes content the user actively submits. It does not read private apps, send messages, contact the scammer, report automatically, freeze accounts, or execute financial actions.

LUCID is not described as fully private or end-to-end encrypted. User-submitted content may temporarily pass through the backend and Gemini for analysis. Saved reviews remain on the user's device. Optional pattern saving stores only anonymized scam structure, not original screenshots, full chats, names, accounts, or contact details.

## Challenges

The hardest challenge was avoiding both extremes: a passive classifier that only labels messages and a panic machine that over-warns users. LUCID uses cognitive triage so low-risk messages stay calm, while high-risk pressure chains trigger stronger guidance.

Another challenge was calibrating investment and wallet screenshots. A normal wallet page should not become Red just because numbers are large, but a fake new-token page with countdown pressure, unverified returns, and buy/recharge prompts should be treated as suspicious.

## What's Next

Future versions can add stronger Agent Builder orchestration, a live MongoDB MCP deployment, privacy-preserving redaction before upload, regional pattern packs for Southeast Asia, school and NGO education mode, and verified pattern sharing with trusted anti-scam organizations.

## 3-Minute Demo Script

**0:00-0:20**  
Scammers do not only steal money. First, they steal calm. They use fear, urgency, authority, and isolation to make people act before they can verify.

**0:20-0:45**  
LUCID is a cognitive safety agent for the moment before harm happens. It does not blame users, contact the sender, report automatically, or take action for them. It helps them pause and see the pressure pattern.

**0:45-1:15**  
Show the low-risk IG check-in. LUCID recognizes a normal scheduling reminder and keeps it Green, proving it is not designed to over-alarm.

**1:15-2:00**  
Show the airline refund or fake police case. The user uploads screenshots, LUCID enters calm review, Gemini extracts visual and text evidence, and the risk escalates because multiple signals combine.

**2:00-2:35**  
Show the agent tool chain: MongoDB Pattern Memory retrieves similar anonymized patterns, LUCID explains what increased the risk score, then generates safe actions, a safe reply, and a shareable report.

**2:35-3:00**  
Show optional anonymized saving. User-submitted content is not saved by default; if the user confirms, only an abstract pattern is saved to help future users.

## Required Technical Lines for the Video

- "Gemini performs multimodal scam and manipulation analysis."
- "MongoDB acts as Pattern Memory for anonymized scam patterns."
- "The agent retrieves similar patterns before generating safer next actions."
- "The web app is deployed on Google Cloud Run."
- "User-submitted content is not saved by default; anonymized pattern saving is opt-in."
