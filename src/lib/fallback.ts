import { demoCases, samplePatterns } from "@/data/demoCases";
import type { AnalysisResult, PatternRecord, RiskLevel } from "@/lib/types";

const levelRank: Record<RiskLevel, number> = {
  Green: 1,
  Yellow: 2,
  Orange: 3,
  Red: 4
};

export function findDemoResult(demoCaseId?: string, text?: string): AnalysisResult {
  const direct = demoCases.find((demo) => demo.id === demoCaseId);
  if (direct) {
    return { ...direct.result, source: "fallback" };
  }

  const normalized = (text ?? "").toLowerCase();
  if (/whatsapp|whtasapp|goo\.su|安全中心|账号|账户|封禁|注销|验证/.test(normalized)) {
    return ensureBodyguard({
      ...demoCases[3].result,
      source: "fallback",
      evidence: demoCases[3].result.evidence
    });
  }
  if (normalized.includes("embassy") || normalized.includes("police") || normalized.includes("rm650")) {
    return { ...demoCases[2].result, source: "fallback" };
  }
  if (normalized.includes("refund") || normalized.includes("airline") || normalized.includes("bank card")) {
    return { ...demoCases[1].result, source: "fallback" };
  }
  if (normalized.trim().length > 0) {
    return {
      ...demoCases[0].result,
      summary:
        "Fallback triage found no high-risk manipulation chain. Add a Gemini key for live analysis of custom text.",
      evidence_summary:
        "Fallback result for custom text: no high-risk manipulation chain was detected by the local demo heuristic.",
      source: "fallback"
    };
  }

  return { ...demoCases[0].result, source: "fallback" };
}

export function imageOnlyFallback(result: AnalysisResult, hasImage: boolean, outputLanguage: "en" | "zh" = "en"): AnalysisResult {
  if (!hasImage || result.source !== "fallback" || result.risk_level !== "Green") {
    return result;
  }

  const isZh = outputLanguage === "zh";

  return {
    ...result,
    risk_level: "Yellow",
    overall_risk_score: Math.max(result.overall_risk_score, 55),
    scenario: isZh ? "图片内容需要视觉模型复核" : "Image content needs visual review",
    summary: isZh
      ? "你上传的是截图，但当前只返回了本地 fallback，无法可靠读取图片里的页面、按钮和域名。为了避免把可疑网页误判成低风险，LUCID 先标记为黄色，并建议使用 Gemini 视觉分析或补充文字/网址。"
      : "A screenshot was submitted, but the current result came from local fallback rather than live visual analysis. To avoid under-calling a suspicious page, LUCID marks this as Yellow and recommends Gemini visual analysis or adding text/URL context.",
    manipulation_chain: ["Visual Review Needed", "Due Diligence Needed"],
    evidence: [
      {
        text: isZh ? "已提交截图，但未完成实时视觉分析" : "Screenshot submitted without live visual analysis",
        type: isZh ? "视觉复核需要" : "Visual Review Needed",
        risk_score: 55,
        reason: isZh
          ? "本地 fallback 不能像 Gemini 一样读取截图里的 UI、按钮、倒计时、域名和付款入口，因此不能给出绿色低风险结论。"
          : "Local fallback cannot read UI, buttons, countdowns, domains, or payment prompts inside the screenshot like Gemini can, so it should not return a Green result."
      }
    ],
    tool_timeline: [
      "Image was submitted.",
      "Live visual analysis was unavailable, so LUCID used a cautious fallback.",
      "User should add URL/text context or enable Gemini visual analysis for a stronger judgment."
    ],
    tool_calls: [{ tool: "Cautious Image Fallback", result: "Raised image-only fallback from Green to Yellow." }],
    agent_actions: isZh
      ? ["不要只凭截图里的收益或按钮马上操作。", "补充可疑网址或页面文字再复核。", "如果页面要求充值、买币、连接钱包或给验证码，先停止操作。"]
      : [
          "Do not act immediately based only on profit claims or buttons in the screenshot.",
          "Add the suspicious URL or page text and review again.",
          "If the page asks for deposits, coin purchase, wallet connection, or codes, pause first."
        ],
    verification_checklist: isZh
      ? ["确认是否启用了 Gemini 视觉分析。", "补充页面域名、按钮文字和对方是否催促你操作。", "从官方或可信来源核实项目。"]
      : [
          "Check whether Gemini visual analysis is enabled.",
          "Add the page domain, button text, and whether anyone pressured you to act.",
          "Verify the project through official or trusted sources."
        ],
    safe_reply: isZh
      ? "我会先核实这个页面和项目来源，不会现在充值、买币或连接钱包。"
      : "I will verify this page and project source first. I will not deposit, buy, or connect a wallet right now.",
    evidence_summary: isZh
      ? "截图已提交，但未完成实时视觉识别。当前不能确认低风险；建议补充网址/文字或启用 Gemini 视觉分析。"
      : "A screenshot was submitted without live visual recognition. This cannot be treated as low risk; add URL/text context or enable Gemini visual analysis.",
    bodyguard_mode: false
  };
}

export function searchLocalPatterns(chain: string[], scenario?: string): PatternRecord[] {
  const query = chain.map((item) => item.toLowerCase());
  const scenarioText = (scenario ?? "").toLowerCase();

  return samplePatterns
    .map((pattern) => {
      const chainScore = pattern.manipulation_chain.filter((item) =>
        query.includes(item.toLowerCase())
      ).length;
      const scenarioScore = scenarioText && pattern.scenario.toLowerCase().includes(scenarioText) ? 2 : 0;
      return { pattern, score: chainScore + scenarioScore + levelRank[pattern.risk_level] / 10 };
    })
    .filter((item) => item.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.pattern)
    .slice(0, 3);
}

export function ensureBodyguard(result: AnalysisResult, contextText = ""): AnalysisResult {
  result = calibrateAccountPhishing(result, contextText);
  result = calibratePhoneScam(result, contextText);
  result = calibrateAuthorityThreat(result, contextText);
  result = calibrateRomanceInvestment(result, contextText);
  result = calibrateInvestmentPage(result, contextText);
  result = calibrateBenignAssetPage(result, contextText);
  result = calibrateNormalInteraction(result, contextText);
  const bodyguardMode = result.risk_level === "Orange" || result.risk_level === "Red";
  return {
    ...result,
    overall_risk_score: clampScore(result.overall_risk_score),
    evidence: result.evidence.map((item) => ({
      ...item,
      risk_score: clampScore(item.risk_score)
    })),
    bodyguard_mode: bodyguardMode,
    tool_timeline:
      result.tool_timeline.length > 0
        ? result.tool_timeline
        : [
            "Gemini Analyzer processed the submitted content.",
            `Cognitive Triage assigned ${result.risk_level} risk.`,
            bodyguardMode
              ? "Bodyguard Mode prepared user-controlled protective actions."
              : "Escalation Gate kept Bodyguard Mode off."
          ]
  };
}

function textBundle(result: AnalysisResult, contextText = "") {
  return [
    contextText,
    result.scenario,
    result.summary,
    result.evidence_summary,
    result.safe_reply,
    ...result.agent_actions,
    ...result.verification_checklist,
    ...result.manipulation_chain,
    ...result.evidence.flatMap((item) => [item.text, item.type, item.reason])
  ].join(" ");
}

function prefersChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function uniqueChain(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function calibrateAccountPhishing(result: AnalysisResult, contextText = ""): AnalysisResult {
  const combined = textBundle(result, contextText);

  const brandOrAccountContext = /whatsapp|whtasapp|facebook|instagram|telegram|账号|账户|号码|account security|account verification|security center|安全中心/i.test(
    combined
  );
  const accountThreat = /账号|账户|号码|account.*(?:suspend|delete|blocked|ban|verification)|封禁|注销|限制|ban|blocked|delete|suspend/i.test(
    combined
  );
  const suspiciousLink = /goo\.su|whtasapp|whatsapp-a|短链接|非官方|suspicious link|shortened|misspelled/i.test(
    combined
  );
  const urgentVerify = /立即|马上|12小时|安全中心|验证|verify|urgent|immediately|within/i.test(combined);

  if (!(brandOrAccountContext && accountThreat && suspiciousLink && urgentVerify)) {
    return result;
  }

  const prefersZh = /[\u4e00-\u9fff]/.test(combined);

  return {
    ...result,
    risk_level: "Red",
    overall_risk_score: Math.max(result.overall_risk_score, 90),
    scenario: prefersZh ? "社交账号安全中心钓鱼" : "Social account security-center phishing",
    summary: prefersZh
      ? "这类消息同时使用账号封禁威胁、立即验证要求和非官方链接，是高风险账号接管钓鱼模式。"
      : "This combines account-suspension pressure, immediate verification, and non-official links, which is a high-risk account-takeover phishing pattern.",
    manipulation_chain: uniqueChain([
      ...result.manipulation_chain,
      "Brand Impersonation",
      "Account Threat",
      "Urgency",
      "Suspicious Link"
    ]),
    agent_actions: prefersZh
      ? ["不要点击消息里的链接。", "只从官方 App 或官网自行进入核实。", "不要输入验证码、密码或账号恢复信息。"]
      : [
          "Do not open links in the message.",
          "Verify only inside the official app or official website.",
          "Do not enter OTPs, passwords, or account recovery details."
        ],
    safe_reply: prefersZh
      ? "我会直接从官方 App 核实账号状态，不会点击这条消息里的链接。"
      : "I will check my account directly in the official app and will not open links from this message.",
    evidence_summary: prefersZh
      ? "高风险账号钓鱼：消息威胁账号封禁或注销，要求立即验证，并使用短链接或仿冒域名。"
      : "High-risk account phishing: the message threatens suspension or deletion, demands immediate verification, and uses shortened or spoofed domains.",
    bodyguard_mode: true
  };
}

function calibrateAuthorityThreat(result: AnalysisResult, contextText = ""): AnalysisResult {
  const combined = textBundle(result, contextText);
  const authority = /公安|警察|警方|警官|派出所|大使馆|领事馆|移民局|法院|检察|海关|银行风控|police|officer|inspector|embassy|consulate|immigration|court|prosecutor|customs|law enforcement|government|tax|bukit aman|crime investigation department|commercial crime/i.test(
    combined
  );
  const threat = /拘留|逮捕|抓捕|通缉|立案|洗钱|诈骗案|涉嫌|护照冻结|坐牢|冻结|封锁|上门|派人|arrest|detain|detained|warrant|money laundering|criminal|suspected|suspected of involvement|case file|passport.*frozen|freeze|frozen|blocked|jail|send people/i.test(
    combined
  );
  const isolation = /不要告诉|不能告诉|保密|不要挂电话|不要搜索|不要报警|do not tell|don't tell|do not hang up|stay on the line|do not search|secret/i.test(
    combined
  );
  const demand = /转账|付款|汇款|保证金|手续费|解冻|税|验证码|银行卡|人脸|otp|verification code|bank card|face scan|transfer|pay|deposit|fee|tax|unlock|guarantee/i.test(
    combined
  );

  if (!(authority && threat && (isolation || demand))) {
    return result;
  }

  const prefersZh = prefersChinese(combined);
  return {
    ...result,
    risk_level: "Red",
    overall_risk_score: Math.max(result.overall_risk_score, demand ? 95 : 90),
    scenario: prefersZh ? "权威冒充与威胁施压" : "Authority impersonation with threat pressure",
    summary: prefersZh
      ? "内容结合官方身份、法律或人身威胁，并试图让用户立即配合或隔离求助，是高风险权威冒充模式。"
      : "The content combines official authority, legal or physical threats, and pressure to cooperate or stay isolated, which is a high-risk impersonation pattern.",
    manipulation_chain: uniqueChain([
      ...result.manipulation_chain,
      "Authority Impersonation",
      "Fear",
      isolation ? "Isolation" : "",
      demand ? "Financial or Sensitive Data Demand" : ""
    ]),
    evidence: [
      {
        text: prefersZh ? "官方/执法身份 + 威胁后果" : "Official or law-enforcement identity with threatened consequences",
        type: "Authority Impersonation",
        risk_score: demand ? 95 : 90,
        reason: prefersZh
          ? "内容使用官方身份制造服从压力，并伴随拘留、冻结、洗钱或案件等威胁。"
          : "The content uses official identity to pressure compliance and combines it with detention, freezing, money-laundering, or case-file threats."
      },
      {
        text: isolation
          ? prefersZh
            ? "不要告诉别人 / 不要搜索"
            : "Do not tell others or search online"
          : prefersZh
            ? "要求立即配合"
            : "Immediate cooperation demand",
        type: isolation ? "Isolation" : "Urgency",
        risk_score: isolation ? 92 : 84,
        reason: prefersZh
          ? "试图切断用户向外部求助或独立核实的机会。"
          : "This attempts to cut off outside help or independent verification."
      },
      ...(demand
        ? [
            {
              text: prefersZh ? "付款、保证金或敏感信息要求" : "Payment, deposit, or sensitive-data demand",
              type: "Financial or Sensitive Data Demand",
              risk_score: 96,
              reason: prefersZh
                ? "权威威胁一旦结合付款、保证金、验证码、银行卡或身份信息要求，应按高风险处理。"
                : "Authority pressure combined with payment, deposit, OTP, card, or identity requests should be treated as high risk."
            }
          ]
        : [])
    ],
    tool_timeline: [
      "Gemini Analyzer extracted or reviewed the submitted content.",
      "Cognitive Triage detected authority, threat, isolation, and demand signals.",
      "Escalation Gate upgraded this to Red because multiple strong-risk signals combine.",
      "Bodyguard Mode prepared user-controlled protective actions."
    ],
    tool_calls: [
      {
        tool: "Cognitive Triage",
        result: "Detected authority impersonation with threat pressure."
      }
    ],
    agent_actions: prefersZh
      ? ["不要继续回复或转账。", "不要提供验证码、银行卡、人脸或身份信息。", "只通过官方公开渠道独立核实。"]
      : [
          "Do not keep replying or transfer money.",
          "Do not provide OTPs, card details, face scans, or identity information.",
          "Verify only through official public channels you find independently."
        ],
    verification_checklist: prefersZh
      ? ["先截图保存证据。", "不要使用对方提供的电话或链接。", "找可信任的人一起确认，必要时联系当地官方渠道。"]
      : [
          "Save screenshots as evidence first.",
          "Do not use phone numbers or links provided by the sender.",
          "Ask a trusted person to review it with you and contact local official channels if needed."
        ],
    safe_reply: prefersZh
      ? "我会通过官方公开渠道独立核实，不会在这里继续提供信息或付款。"
      : "I will verify this through official public channels and will not provide information or payment here.",
    evidence_summary: prefersZh
      ? "高风险权威冒充：内容出现官方/执法身份、威胁后果，并伴随隔离或付款/敏感信息要求。"
      : "High-risk authority impersonation: the content uses official/law-enforcement identity, threatened consequences, and isolation or payment/sensitive-data pressure."
  };
}

function calibratePhoneScam(result: AnalysisResult, contextText = ""): AnalysisResult {
  const combined = textBundle(result, contextText);
  const phoneContext = /电话|通话|来电|客服来电|phone|call|caller|hotline|on the line/i.test(combined);
  const isolation = /不要挂电话|别挂|保持通话|不要告诉|不要报警|不要搜索|do not hang up|don't hang up|stay on the line|do not tell|don't tell/i.test(
    combined
  );
  const sensitiveDemand = /转账|汇款|付款|验证码|银行卡|密码|人脸|共享屏幕|下载|otp|verification code|transfer|pay|bank card|password|screen share|install/i.test(
    combined
  );
  const authorityOrSupport = /公安|警察|银行|客服|平台|快递|税务|police|bank|support|customer service|delivery|tax/i.test(
    combined
  );

  if (!(phoneContext && isolation && (sensitiveDemand || authorityOrSupport))) {
    return result;
  }

  const prefersZh = prefersChinese(combined);
  return {
    ...result,
    risk_level: "Red",
    overall_risk_score: Math.max(result.overall_risk_score, 92),
    scenario: prefersZh ? "电话通话施压诈骗" : "Phone-call pressure scam",
    summary: prefersZh
      ? "来电要求用户保持通话、不要求助，并涉及转账、验证码或官方/客服身份，是高风险电话诈骗模式。"
      : "The caller pressures the user to stay on the line or avoid help, with payment, OTP, or official/support identity cues, which is high risk.",
    manipulation_chain: uniqueChain([
      ...result.manipulation_chain,
      "Isolation",
      "Urgency",
      "Authority or Support Impersonation",
      sensitiveDemand ? "Sensitive Data or Payment Demand" : ""
    ]),
    agent_actions: prefersZh
      ? ["先挂断电话。", "不要提供验证码或转账。", "从官方 App 或官网重新查找联系方式。"]
      : [
          "Hang up first.",
          "Do not provide OTPs or transfer money.",
          "Find the official contact again through the official app or website."
        ],
    safe_reply: prefersZh ? "我会先挂断，并通过官方渠道重新核实。" : "I will hang up and verify again through official channels.",
    evidence_summary: prefersZh
      ? "高风险电话施压：要求保持通话或不要告诉别人，同时出现官方/客服身份或转账、验证码等敏感要求。"
      : "High-risk phone pressure: the caller asks the user to stay isolated while introducing official/support identity or sensitive payment/OTP requests."
  };
}

function calibrateRomanceInvestment(result: AnalysisResult, contextText = ""): AnalysisResult {
  const combined = textBundle(result, contextText);
  const relationship = /恋爱|网恋|对象|男朋友|女朋友|亲爱的|宝贝|信任我|relationship|romance|dating|boyfriend|girlfriend|dear|trust me/i.test(
    combined
  );
  const investment = /投资|炒币|股票|外汇|合约|量化|导师|跟单|收益|平台|提现|充值|crypto|bitcoin|investment|stock|forex|trading|mentor|profit|platform|withdraw|deposit/i.test(
    combined
  );
  const demand = /充值|转账|入金|保证金|税|手续费|解冻|提现失败|unlock|withdrawal|fee|tax|deposit|transfer|pay|guarantee/i.test(
    combined
  );

  if (!(relationship && investment)) {
    return result;
  }

  const prefersZh = prefersChinese(combined);
  return {
    ...result,
    risk_level: demand ? "Red" : maxRisk(result.risk_level, "Orange"),
    overall_risk_score: Math.max(result.overall_risk_score, demand ? 92 : 78),
    scenario: prefersZh ? "关系投资诈骗风险" : "Relationship investment scam risk",
    summary: prefersZh
      ? demand
        ? "关系信任被用于引导投资并出现充值、提现、税费或解冻要求，这是高风险杀猪盘/关系投资诈骗模式。"
        : "关系信任被用于引导投资或交易，已形成明显风险，需要先独立核实。"
      : demand
        ? "Relationship trust is being used to push investment with deposit, withdrawal, tax, fee, or unlock demands, a high-risk relationship-investment scam pattern."
        : "Relationship trust is being used to push investment or trading, which is a clear risk pattern that needs independent verification.",
    manipulation_chain: uniqueChain([
      ...result.manipulation_chain,
      "Relationship Trust",
      "Investment Pressure",
      demand ? "Financial Demand" : ""
    ]),
    agent_actions: prefersZh
      ? ["不要充值或继续投入。", "不要只相信对方发来的平台链接。", "找可信任的人一起核实平台和对方身份。"]
      : [
          "Do not deposit or invest more.",
          "Do not rely on platform links sent by the other person.",
          "Ask a trusted person to verify the platform and the person's identity with you."
        ],
    safe_reply: prefersZh
      ? "我不会继续投资或充值，会先独立核实平台和信息。"
      : "I will not invest or deposit more and will verify the platform independently first.",
    evidence_summary: prefersZh
      ? "关系投资风险：对方利用信任关系引导投资/交易，若伴随充值、提现、税费或解冻要求则为高风险。"
      : "Relationship investment risk: trust is used to push investment/trading; deposit, withdrawal, tax, fee, or unlock demands make it high risk."
  };
}

function calibrateInvestmentPage(result: AnalysisResult, contextText = ""): AnalysisResult {
  const combined = textBundle(result, contextText).toLowerCase();
  if (
    result.risk_level === "Red" &&
    result.manipulation_chain.some((item) => /relationship trust|关系|romance/i.test(item))
  ) {
    return result;
  }

  const investmentPage =
    /crypto|bitcoin|btc|stock|forex|trading|investment|wallet|exchange|coin|token|收益|财富|投资|炒币|股票|外汇|交易|钱包|交易所|新币|上线|资产/.test(
      combined
    );
  const hypeOrCountdown =
    /countdown|limited|new wealth|high return|guaranteed|profit|倒计时|限时|财富|高收益|稳赚|保本|翻倍|新篇章|正式上线/.test(
      combined
    );
  const hardDemand =
    /deposit|transfer|pay|withdraw|unlock|fee|tax|seed phrase|private key|otp|充值|转账|付款|提现|解冻|手续费|税|助记词|私钥|验证码/.test(
      combined
    );
  const fakeCoinLaunch =
    /npc2|npcc|obx|new coin|new token|early access|weekly growth|unverified|not verified|invest now|buy coin|chain recharge|链上充币|买币|新币|未验证|未审计|开启财富|随时随地开启交易|正式上线/.test(
      combined
    );

  if (!(investmentPage && hypeOrCountdown)) {
    return result;
  }

  const prefersZh = prefersChinese(textBundle(result, contextText));
  const hasNegatedDemand =
    /没有|未看到|没有看到|no clear|no visible|without|not visible|not asking/i.test(combined);
  const demandIsActionable = (hardDemand || fakeCoinLaunch) && !hasNegatedDemand;
  const calibratedRisk = fakeCoinLaunch ? "Orange" : demandIsActionable ? "Orange" : "Yellow";
  const calibratedScore = fakeCoinLaunch ? 76 : demandIsActionable ? 70 : 45;

  return {
    ...result,
    risk_level: maxRisk(result.risk_level, calibratedRisk),
    overall_risk_score: Math.max(Math.min(result.overall_risk_score, fakeCoinLaunch ? 84 : demandIsActionable ? 82 : 74), calibratedScore),
    scenario: prefersZh
      ? fakeCoinLaunch
        ? "可疑新币投资页面"
        : "可疑投资页面"
      : fakeCoinLaunch
        ? "Suspicious new-token investment page"
        : "Suspicious investment page",
    summary: prefersZh
      ? fakeCoinLaunch
        ? "页面同时出现新币上线、财富叙事、倒计时、买币/链上充币入口或未验证信息。这不是普通钱包余额页，而是明显的高压投资诱导页面，需要先暂停并独立核实。"
        : demandIsActionable
        ? "页面有投资、资产或高收益宣传信号，并出现充值、提现、解冻、手续费或税费等操作要求，需要高度谨慎。"
        : "页面有投资、资产或高收益宣传信号，但还没有看到明确充值、提现解冻、手续费、税费或敏感信息要求。"
      : fakeCoinLaunch
        ? "The page combines a new-token launch, wealth narrative, countdown pressure, buy/recharge entry points, or unverified claims. This is not a normal wallet balance page; it is a clear investment-pressure page that needs independent verification."
        : demandIsActionable
        ? "The page shows investment, asset, or high-return promotion signals plus deposit, withdrawal, unlock, fee, or tax language, so it needs high caution."
        : "The page shows investment, asset, or high-return promotion signals, but no clear deposit, withdrawal-unlock, fee, tax, or sensitive-data demand is visible.",
    manipulation_chain: uniqueChain([
      ...result.manipulation_chain,
      "Investment Hype",
      fakeCoinLaunch ? "Speculative Token Launch" : "",
      fakeCoinLaunch ? "Actionable Buy Prompt" : "",
      "Due Diligence Needed"
    ]),
    evidence_summary: prefersZh
      ? fakeCoinLaunch
        ? "可疑新币投资诱导：页面使用新币上线、财富承诺、倒计时和买币/充币入口推动用户行动。真实交易所或普通钱包页不会仅因余额、行情或价格数字被升级。"
        : "可疑但证据不足：投资页面或倒计时/收益宣传需要核实；只有出现充值、解冻、手续费、税费或私钥/验证码要求时才升级为高风险。"
      : fakeCoinLaunch
        ? "Suspicious new-token investment pressure: the page uses launch hype, wealth claims, countdown pressure, and buy/recharge entry points to push action. Normal exchanges or wallet pages are not escalated merely for balances, prices, or market numbers."
        : "Suspicious but incomplete: investment pages or countdown/profit marketing need verification; escalate only with deposit, unlock, fee, tax, private-key, or OTP demands.",
    agent_actions: prefersZh
      ? ["不要因为倒计时或收益宣传马上操作。", "独立查询平台资质和域名。", "如果有人催你充值或解冻，再把对话交给 LUCID 复核。"]
      : [
          "Do not act immediately because of a countdown or profit claim.",
          "Independently check the platform and domain.",
          "If someone pressures you to deposit or unlock funds, review that conversation with LUCID."
        ]
  };
}

function calibrateBenignAssetPage(result: AnalysisResult, contextText = ""): AnalysisResult {
  const combined = textBundle(result, contextText).toLowerCase();

  const looksLikeAssetPage =
    /bitcoin|btc|crypto|wallet|exchange|portfolio|balance|asset|transaction|coinbase|binance|metamask|trust wallet|banking|payment|account page|比特币|加密货币|钱包|交易所|资产|余额|持仓|交易记录|账户页面|银行卡页面|付款页面/.test(
      combined
    );

  const hasPressureInstruction =
    /send|transfer|pay|deposit|unlock|withdraw|fee|tax|guarantee|seed phrase|private key|otp|verification code|click|link|urgent|within|minutes|hours|freeze|blocked|police|embassy|arrest|secret|do not tell|转账|付款|充值|缴纳|保证金|手续费|税|解冻|提现|验证码|助记词|私钥|点击|链接|立刻|马上|分钟|小时|封禁|冻结|公安|警察|大使馆|拘留|逮捕|不要告诉|保密/.test(
      combined
    );
  const explicitlyNoPressure =
    /没有任何人要求|没有人要求|没有要求|没有看到.*(?:要求|客服|催促|充值|提现|解冻|手续费|税费|验证码|助记词|私钥)|无(?:转账|付款|充值|缴费|验证码|助记词|私钥|威胁|催促)|no (?:one )?(?:asks?|requires?|pressure)|no visible (?:pressure|demand|request)|without (?:pressure|coercion|payment demand|sensitive-data demand)/.test(
      combined
    );

  const amountOnlyEscalation =
    (result.risk_level === "Orange" || result.risk_level === "Red" || result.overall_risk_score >= 80) &&
    looksLikeAssetPage &&
    (!hasPressureInstruction || explicitlyNoPressure);

  if (!amountOnlyEscalation) {
    return result;
  }

  const prefersZh =
    /[\u4e00-\u9fff]/.test([result.summary, result.evidence_summary, result.safe_reply].join(" ")) ||
    /[\u4e00-\u9fff]/.test(result.evidence.map((item) => item.reason).join(" "));

  return {
    ...result,
    risk_level: "Yellow",
    overall_risk_score: Math.min(result.overall_risk_score, 35),
    scenario: prefersZh ? "账户或钱包页面，未发现明确施压" : "Account or wallet page without clear pressure",
    summary: prefersZh
      ? "LUCID 看到了账户、钱包或资产页面，但没有看到明确的施压要求、威胁、保密指令或敏感信息索取。"
      : "LUCID found an account, wallet, or asset page, but did not find a clear coercive request, threat, secrecy instruction, or sensitive-data demand.",
    evidence_summary: prefersZh
      ? "可见内容更像资产或钱包信息。仅有大额数字本身不足以判断为诈骗，除非同时出现诱导操作或操控指令。"
      : "The visible content appears to show asset or wallet information. Large numbers alone are not enough to classify a scam without a manipulative instruction.",
    manipulation_chain: result.manipulation_chain.filter(
      (item) => !/payment|financial|money|amount|crypto|asset/i.test(item)
    ),
    evidence: result.evidence
      .filter((item) => !/amount|balance|asset|portfolio|wallet|crypto|money|financial/i.test(item.type))
      .slice(0, 3),
    agent_actions: prefersZh
      ? ["不要只因为余额或资产数字很大就付款。", "如果不确定，请从官方来源核实网站或 App。", "先确认是否真的存在施压信号。"]
      : [
          "Do not make a payment only because a balance or asset number looks large.",
          "Verify the site or app through an official source if you are unsure.",
          "Look for actual pressure signals before treating this as high risk."
        ],
    verification_checklist: prefersZh
      ? [
          "确认这个页面是不是你主动打开的官方钱包或交易所。",
          "不要在消息链接打开的页面输入助记词、私钥、验证码或额外费用。",
          "如果是别人发来这个页面施压，请把对方消息单独交给 LUCID 复核。"
        ]
      : [
          "Check whether the page is the official wallet or exchange you intended to open.",
          "Do not enter seed phrases, private keys, OTP codes, or extra fees on a page reached through a message link.",
          "If someone sent this page to pressure you, review that message separately."
        ],
    safe_reply: prefersZh
      ? "我会先通过官方 App 或官网独立核实，再决定是否操作。"
      : "I will verify this independently through the official app or website before taking any action.",
    bodyguard_mode: false
  };
}

function calibrateNormalInteraction(result: AnalysisResult, contextText = ""): AnalysisResult {
  const combined = textBundle(result, contextText).toLowerCase();
  const normalContext =
    /normal interaction|ordinary|low-risk|低风险|普通|聚餐|人数|有空|回复|reminder|check-in|schedule|meeting|dinner|available|reply when/i.test(
      combined
    );
  const dangerousDemand =
    /transfer|pay|deposit|otp|verification code|password|seed phrase|private key|bank card|arrest|police|embassy|freeze|blocked|do not tell|secret|转账|付款|充值|验证码|密码|助记词|私钥|银行卡|逮捕|公安|警察|大使馆|冻结|封禁|不要告诉|保密/.test(
      combined
    );

  if (!normalContext || dangerousDemand) {
    return result;
  }

  const prefersZh = prefersChinese(textBundle(result, contextText));
  return {
    ...result,
    risk_level: "Green",
    overall_risk_score: Math.min(result.overall_risk_score, 18),
    scenario: prefersZh ? "普通社交信息" : "Normal social interaction",
    summary: prefersZh
      ? "消息内容是普通沟通或提醒，没有发现诈骗、操控或敏感信息索取。"
      : "The message is ordinary communication or a reminder with no scam, manipulation, or sensitive-data request detected.",
    manipulation_chain: result.manipulation_chain.filter((item) => !/urgency|pressure|risk/i.test(item)),
    evidence: result.evidence.map((item) => ({ ...item, risk_score: Math.min(item.risk_score, 18) })),
    agent_actions: prefersZh ? ["先暂停，不要立刻回复。"] : ["Pause before replying."],
    verification_checklist: prefersZh ? ["确认发件人身份。"] : ["Confirm the sender identity."],
    safe_reply: prefersZh ? "好的，我稍后回复你。" : "Okay, I will reply later.",
    evidence_summary: prefersZh
      ? "消息是关于普通安排或回复请求，没有发现操纵或敏感信息。"
      : "The message is about an ordinary arrangement or reply request, with no manipulation or sensitive-data request detected.",
    bodyguard_mode: false
  };
}

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return levelRank[a] >= levelRank[b] ? a : b;
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
