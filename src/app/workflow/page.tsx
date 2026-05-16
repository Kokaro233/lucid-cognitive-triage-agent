"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { SiteNav } from "@/components/SiteNav";

export default function WorkflowPage() {
  const { language } = useLanguage();
  const copy =
    language === "zh"
      ? {
          eyebrow: "Agent 流程",
          title: "先冷静，再分析，最后由用户决定行动。",
          body: "LUCID 专门面向那种骗子让你不敢搜索、不敢告诉别人的时刻。",
          steps: [
            ["01", "冷静", "先提醒用户：现在不需要回复、付款，也不需要一个人保守秘密。"],
            ["02", "提交", "用户上传截图、粘贴文字或电话转写。LUCID 不会偷偷监控聊天。"],
            ["03", "感知", "Google Cloud Gemini 提取可见文字、威胁、期限、金钱要求和保密压力。"],
            ["04", "分诊", "Agent 判断恐惧、权威、隔离、紧迫感和支付要求是否组合出现。"],
            ["05", "安全行动", "安全回复、证据摘要和核实步骤都由用户自己控制。"]
          ]
        }
      : {
          eyebrow: "Agent workflow",
          title: "Calm first, analyze second, act only with the user.",
          body:
            "LUCID is designed around the moment when a scammer tries to make searching or telling someone feel dangerous.",
          steps: [
            ["01", "Calm", "LUCID first tells the user they do not need to reply, pay, or keep the secret alone."],
            ["02", "Submit", "The user uploads a screenshot, pastes text, or adds a call transcript. LUCID never monitors chats silently."],
            ["03", "Perceive", "Google Cloud Gemini extracts visible text, threats, deadlines, money requests, and secrecy pressure."],
            ["04", "Triage", "The agent checks whether fear, authority, isolation, urgency, and payment demands combine."],
            ["05", "Act safely", "Safe replies, evidence summaries, and verification steps stay under user control."]
          ]
        };

  return (
    <main>
      <section className="page-hero compact-hero">
        <SiteNav />
        <div className="page-heading">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
        </div>
      </section>
      <section className="workflow-band standalone">
        <div className="workflow-grid detail-grid">
          {copy.steps.map(([number, title, body]) => (
            <article className="workflow-step detail-step" key={title}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
