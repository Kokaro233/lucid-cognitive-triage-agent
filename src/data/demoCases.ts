import type { DemoCase, PatternRecord } from "@/lib/types";

export const demoCases: DemoCase[] = [
  {
    id: "low-risk-checkin",
    title: "Low-risk check-in",
    label: "Low Risk",
    description: "A normal reminder with mild urgency but no authority, secrecy, money, OTP, or identity pressure.",
    image: "/api/case-images/case-01-low-risk-ig-chat.png",
    text:
      "Hey, can you reply today if you have time? I need to confirm the group dinner booking before tonight. No worries if not.",
    result: {
      risk_level: "Green",
      overall_risk_score: 12,
      scenario: "Normal scheduling reminder",
      summary:
        "This message contains mild time pressure, but it does not combine with secrecy, authority pressure, financial demand, or identity requests.",
      manipulation_chain: ["Mild urgency"],
      evidence: [
        {
          text: "reply today",
          type: "Urgency",
          risk_score: 12,
          reason:
            "A deadline is present, but it is attached to a normal scheduling context and does not ask for sensitive action."
        }
      ],
      tool_timeline: [
        "Gemini Analyzer extracted the conversation text.",
        "Cognitive Triage found mild urgency only.",
        "Escalation Gate kept Bodyguard Mode off.",
        "No Pattern Memory search was required."
      ],
      tool_calls: [
        { tool: "Cognitive Triage", result: "No meaningful manipulation chain detected." }
      ],
      agent_actions: [
        "Continue normally.",
        "Avoid sharing OTP, bank details, or identity documents in any chat."
      ],
      verification_checklist: [
        "No special verification needed.",
        "Keep normal caution if the conversation changes toward money, identity, or secrecy."
      ],
      safe_reply: "Sure, I will confirm when I can.",
      evidence_summary:
        "Low-risk reminder. The message contains a normal scheduling deadline but no sensitive request or manipulation chain.",
      bodyguard_mode: false,
      source: "fallback"
    }
  },
  {
    id: "airline-refund",
    title: "Airline refund phishing",
    label: "Red",
    description: "A phone-call refund scam that sends the user to a fake compensation website.",
    images: [
      "/api/case-images/case-02-airline-call.png",
      "/api/case-images/case-02-airline-fake-site.png",
    ],
    text:
      "Caller: This is Airline Support. Your flight has been cancelled due to a system issue. You are eligible for immediate compensation, but the refund window will close in 30 minutes. Please open the compensation website now: https://airline-refund-check.example. Do not close the page until verification is complete.\nWebsite: SkyBridge Airlines Compensation Center. Your cancellation compensation expires in 30 minutes. Verify your passenger details to receive instant compensation. Fields request full name, booking reference, bank card number, card expiry date, security code, and face verification.",
    result: {
      risk_level: "Red",
      overall_risk_score: 92,
      scenario: "Airline refund phishing",
      summary:
        "The call and website combine airline-support impersonation, urgency, a suspicious compensation link, bank-card fields, security code, and face verification. This is high-risk refund phishing.",
      manipulation_chain: ["Support Impersonation", "Urgency", "Suspicious Link", "Financial Request", "Identity Leverage"],
      evidence: [
        {
          text: "refund expires in 30 minutes",
          type: "Urgency",
          risk_score: 79,
          reason: "A short deadline pressures the user to act before verifying the claim.",
          location: { x: 70, y: 110, width: 320, height: 42 }
        },
        {
          text: "verify your bank card and face scan",
          type: "Identity Leverage + Financial Request",
          risk_score: 86,
          reason:
            "The message requests payment and biometric-like verification in a refund flow, which is a sensitive context.",
          location: { x: 70, y: 188, width: 390, height: 48 }
        }
      ],
      tool_timeline: [
        "Gemini Analyzer extracted the suspicious refund request.",
        "Cognitive Triage detected Authority + Urgency + Financial Request.",
        "MongoDB Pattern Memory matched airline refund phishing behavior.",
        "Bodyguard Mode prepared verification guidance and a safe reply."
      ],
      tool_calls: [
        { tool: "MongoDB Pattern Memory", result: "Matched SEA-AIRLINE-REFUND-001." },
        { tool: "Safe Reply Generator", result: "Prepared a reply that avoids sharing card data." }
      ],
      agent_actions: [
        "Do not open the provided link.",
        "Verify the refund from the airline website or app directly.",
        "Do not provide card, OTP, face scan, or identity details through the message link."
      ],
      verification_checklist: [
        "Open the airline website or app manually.",
        "Use only official customer support numbers from the airline domain.",
        "Never enter card or OTP details through a link sent in chat."
      ],
      safe_reply:
        "I will verify this directly through the official airline website or app. I will not provide card or identity details through this link.",
      evidence_summary:
        "High-risk airline refund phishing: the caller claims a cancellation refund, pushes a 30-minute deadline, sends a fake compensation website, and requests bank card, security code, and face verification.",
      bodyguard_mode: true,
      source: "fallback"
    }
  },
  {
    id: "embassy-police",
    title: "Fake embassy / police scam",
    label: "Red",
    description: "A high-risk authority scam using fear, secrecy, legal threats, and a large guarantee payment.",
    image: "/api/case-images/case-03-authority-threat.png",
    text:
      "Hello, I am Inspector Daniel Lee from Bukit Aman Commercial Crime Investigation Department, Malaysia. You are suspected of involvement in online fraud and money laundering activities. A case file has been opened under your name. This is a sensitive case. Do not tell your family. Do not search online. Cooperate now and transfer a security deposit to our safe account for verification, or you will be detained and your passport will be frozen.",
    result: {
      risk_level: "Red",
      overall_risk_score: 96,
      scenario: "Embassy impersonation / law enforcement scam",
      summary:
        "This conversation combines authority pressure, fear, isolation, urgency, and a large financial demand. Bodyguard Mode is activated.",
      manipulation_chain: ["Authority", "Fear", "Isolation", "Urgency", "Financial Demand"],
      evidence: [
        {
          text: "Embassy Office",
          type: "Authority",
          risk_score: 90,
          reason: "The sender claims an official identity to suppress doubt and increase compliance.",
          location: { x: 64, y: 82, width: 210, height: 42 }
        },
        {
          text: "money laundering case",
          type: "Fear + Authority",
          risk_score: 94,
          reason: "A legal accusation is used to create panic and reduce rational verification.",
          location: { x: 64, y: 145, width: 315, height: 44 }
        },
        {
          text: "Do not tell your family or search online",
          type: "Isolation",
          risk_score: 98,
          reason: "The sender tries to cut the user off from social support and independent verification.",
          location: { x: 64, y: 218, width: 420, height: 48 }
        },
        {
          text: "RM650,000 within two hours",
          type: "Financial Demand + Urgency",
          risk_score: 99,
          reason: "A large payment is paired with a short deadline, which is a critical escalation signal.",
          location: { x: 64, y: 292, width: 360, height: 48 }
        }
      ],
      tool_timeline: [
        "Gemini Analyzer extracted official-identity claims, legal threats, secrecy, and payment demand.",
        "Cognitive Triage detected Authority + Fear + Isolation + Urgency + Financial Demand.",
        "MongoDB Pattern Memory matched fake embassy / police scam pattern.",
        "Bodyguard Mode activated because multiple high-risk signals combined.",
        "Safe Reply Generator prepared a non-disclosing response.",
        "Evidence Summary generated a shareable note for a trusted person."
      ],
      tool_calls: [
        { tool: "MongoDB Pattern Memory", result: "Matched SEA-EMBASSY-001." },
        { tool: "Safe Reply Generator", result: "Prepared non-disclosing reply." },
        { tool: "Evidence Summary", result: "Prepared trusted-person review note." }
      ],
      agent_actions: [
        "Pause immediately and do not transfer money.",
        "Tell a trusted person outside the chat.",
        "Verify through official embassy or police channels found independently.",
        "Save this evidence summary before blocking or reporting the sender."
      ],
      verification_checklist: [
        "Do not call phone numbers provided by the sender.",
        "Search the official embassy website independently.",
        "Ask a trusted person to review the message before any payment.",
        "Do not share passport, bank, OTP, or payment details."
      ],
      safe_reply:
        "I will not take action through this chat. I will verify this independently through official public channels and will not send money or personal information here.",
      evidence_summary:
        "High-risk impersonation scam: the sender claims embassy/law-enforcement authority, alleges money laundering, instructs the user not to tell family or search online, and demands RM650,000 within two hours.",
      bodyguard_mode: true,
      source: "fallback"
    }
  },
  {
    id: "whatsapp-security-phishing",
    title: "WhatsApp security-center phishing",
    label: "Orange",
    description:
      "A fake account-warning message that uses service impersonation, deadline pressure, and suspicious security-center links.",
    image: "/api/case-images/case-04-whatsapp-phishing.png",
    text:
      "安全提醒：此账户长期未验证即将被封禁。立即登录安全中心可恢复使用：https://goo.su/o.whatsapp\n您的 WhatsApp 号码长期未验证，账户将被封禁。请立即登录安全中心完成验证：https://goo.su/i_whatsapp\n您的 WhatsApp 账号涉嫌违规，12小时后将被自动注销，请登录官网：https://whtasapp-a.com 解除限制！",
    result: {
      risk_level: "Red",
      overall_risk_score: 90,
      scenario: "WhatsApp account verification phishing",
      summary:
        "The messages impersonate WhatsApp account security and use account-ban pressure to push the user toward suspicious links. This should be verified only through the official app or website.",
      manipulation_chain: ["Brand Impersonation", "Urgency", "Account Threat", "Suspicious Link"],
      evidence: [
        {
          text: "账户长期未验证即将被封禁",
          type: "Account Threat",
          risk_score: 86,
          reason: "The sender threatens account suspension to pressure immediate action."
        },
        {
          text: "立即登录安全中心",
          type: "Urgency",
          risk_score: 84,
          reason: "The wording pushes the user to act quickly instead of checking the source."
        },
        {
          text: "https://goo.su/i_whatsapp",
          type: "Suspicious Link",
          risk_score: 88,
          reason: "A shortened or non-official URL is used for an account verification flow."
        },
        {
          text: "https://whtasapp-a.com",
          type: "Brand Impersonation",
          risk_score: 93,
          reason: "The domain resembles WhatsApp but is not the official WhatsApp domain."
        }
      ],
      tool_timeline: [
        "Gemini Analyzer extracted account-warning messages and URLs.",
        "Cognitive Triage detected Brand Impersonation + Urgency + Account Threat + Suspicious Link.",
        "MongoDB Pattern Memory matched account verification phishing behavior.",
        "Bodyguard Mode prepared official-channel verification guidance."
      ],
      tool_calls: [
        { tool: "MongoDB Pattern Memory", result: "Matched SOCIAL-ACCOUNT-VERIFY-001." },
        { tool: "Safe Reply Generator", result: "Prepared a reply that avoids opening links." }
      ],
      agent_actions: [
        "Do not open the links in the message.",
        "Check account status only inside the official WhatsApp app or official website.",
        "Do not enter SMS codes, passwords, or account recovery details through the message link."
      ],
      verification_checklist: [
        "Open WhatsApp directly from your phone, not from the message link.",
        "Check linked devices and account security settings in the official app.",
        "Treat shortened URLs and misspelled WhatsApp domains as suspicious.",
        "Do not share verification codes or passwords."
      ],
      safe_reply:
        "I will check my account directly in the official WhatsApp app and will not open verification links from this message.",
      evidence_summary:
        "Possible WhatsApp phishing: the messages threaten account suspension or deletion, ask the user to verify immediately, and use shortened or misspelled non-official links.",
      bodyguard_mode: true,
      source: "fallback"
    }
  },
  {
    id: "investment-hype",
    title: "Crypto investment hype page",
    label: "Orange",
    description:
      "A simulated exchange dashboard with countdown pressure, unverified growth claims, and investment tiers.",
    image: "/api/case-images/case-05-investment-hype.png",
    text:
      "OBX simulated dashboard. Early access closes in 01:45:22. OBX Token OBX/USDT. +842% 24h change. Early Access Investment Opportunity. Up to 120% weekly growth (unverified). Early investor bonus allocation. Starter Tier $100 minimum. Growth Tier $1,000 recommended. Whale Tier $10,000 priority access. INVEST NOW. Audits: Not Verified. Disclaimer: simulated dashboard for educational and training purposes only.",
    result: {
      risk_level: "Orange",
      overall_risk_score: 76,
      scenario: "Suspicious new-token investment pressure page",
      summary:
        "The page is not a normal wallet balance screen. It combines new-token launch hype, countdown pressure, unverifiable high-return claims, buy/invest prompts, and unverified audit status. This is an Orange investment-pressure pattern that needs independent verification before any action.",
      manipulation_chain: [
        "Investment Hype",
        "Urgency",
        "Unverified Claims",
        "Speculative Token Launch",
        "Actionable Buy Prompt",
        "Due Diligence Needed"
      ],
      evidence: [
        {
          text: "Early access closes in 01:45:22",
          type: "Urgency",
          risk_score: 72,
          reason: "A countdown can pressure users to act before independently checking the project."
        },
        {
          text: "Up to 120% weekly growth (unverified)",
          type: "Unverified Profit Claim",
          risk_score: 78,
          reason: "High-return claims marked as unverified are a strong reason to slow down and verify."
        },
        {
          text: "Audits: Not Verified",
          type: "Verification Gap",
          risk_score: 74,
          reason: "The page itself indicates that audits are not verified."
        },
        {
          text: "INVEST NOW / buy coin entry points",
          type: "Actionable Buy Prompt",
          risk_score: 76,
          reason: "The page pushes the user toward investing in a speculative token while verification is incomplete."
        }
      ],
      tool_timeline: [
        "Gemini Analyzer extracted investment dashboard content.",
        "Cognitive Triage identified urgency, unverified return claims, buy prompts, and audit gaps.",
        "Escalation Gate raised this to Orange because the page is a speculative-token pressure flow, not a neutral wallet page."
      ],
      tool_calls: [
        { tool: "Cognitive Triage", result: "Assigned Orange risk for suspicious new-token pressure." }
      ],
      agent_actions: [
        "Do not invest because of a countdown or return claim.",
        "Check the domain, project contract, audit status, and independent sources.",
        "If someone is pressuring you to deposit, review that chat separately."
      ],
      verification_checklist: [
        "Search the project outside the platform.",
        "Check whether audits and contract addresses are independently verified.",
        "Do not connect a wallet or approve transactions until verified."
      ],
      safe_reply:
        "I will not invest based on a countdown or unverified return claim. I will verify the project independently first.",
      evidence_summary:
        "Suspicious new-token investment pressure: the page shows a countdown, unverified high-growth claims, investment tiers, buy/invest prompts, and unverified audit status. Normal wallet or exchange pages are not upgraded only for prices or balances; this case is upgraded because it actively promotes a speculative token.",
      bodyguard_mode: true,
      source: "fallback"
    }
  }
];

export const samplePatterns: PatternRecord[] = [
  {
    pattern_id: "SEA-EMBASSY-001",
    scenario: "Fake embassy / police scam",
    language: "en",
    manipulation_chain: ["Authority", "Fear", "Isolation", "Urgency", "Financial Demand"],
    phrases: ["money laundering case", "do not tell your family", "guarantee deposit"],
    risk_level: "Red",
    severity: 96,
    recommended_actions: ["Pause", "Verify official channel", "Tell a trusted person"],
    source: "anonymized_demo_pattern"
  },
  {
    pattern_id: "SEA-AIRLINE-REFUND-001",
    scenario: "Airline refund phishing",
    language: "en",
    manipulation_chain: ["Authority", "Urgency", "Identity Leverage", "Financial Request"],
    phrases: ["refund expires", "verify your bank card", "face scan"],
    risk_level: "Orange",
    severity: 74,
    recommended_actions: ["Do not open link", "Verify through official app", "Do not share OTP"],
    source: "anonymized_demo_pattern"
  },
  {
    pattern_id: "GENERAL-URGENCY-LOW-001",
    scenario: "Low-risk ordinary deadline",
    language: "en",
    manipulation_chain: ["Mild urgency"],
    phrases: ["reply today", "confirm booking"],
    risk_level: "Green",
    severity: 12,
    recommended_actions: ["Continue normally", "Keep normal privacy caution"],
    source: "anonymized_demo_pattern"
  },
  {
    pattern_id: "SOCIAL-ACCOUNT-VERIFY-001",
    scenario: "WhatsApp account verification phishing",
    language: "zh",
    manipulation_chain: ["Brand Impersonation", "Urgency", "Account Threat", "Suspicious Link"],
    phrases: ["长期未验证", "即将被封禁", "安全中心", "解除限制"],
    risk_level: "Red",
    severity: 90,
    recommended_actions: ["Do not open link", "Verify in official app", "Do not share OTP"],
    source: "user_supplied_desensitized_pattern"
  },
  {
    pattern_id: "CRYPTO-NEW-TOKEN-HYPE-001",
    scenario: "Suspicious new-token investment pressure",
    language: "en",
    manipulation_chain: ["Investment Hype", "Urgency", "Unverified Claims", "Actionable Buy Prompt"],
    phrases: ["early access closes", "weekly growth", "not verified", "invest now"],
    risk_level: "Orange",
    severity: 76,
    recommended_actions: ["Do not invest from countdown pressure", "Verify audit and contract independently", "Do not connect wallet until verified"],
    source: "anonymized_demo_pattern"
  }
];
