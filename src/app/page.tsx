"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { SiteNav } from "@/components/SiteNav";
import { demoCases } from "@/data/demoCases";

export default function Home() {
  const { language } = useLanguage();
  const copy =
    language === "zh"
      ? {
          signals: ["冒充权威", "法律威胁", "保密施压", "转账要求", "身份恐吓", "时间催促"],
          trace: [
            ["隔离", "不要告诉家人"],
            ["权威", "大使馆 / 公安身份"],
            ["要求", "两小时内转 RM650,000"]
          ],
          eyebrow: "认知安全 Agent v1.0",
          title: "你可以先停下来。",
          body:
            "如果有人说你告诉别人就会出事，这种压力本身就是危险信号。LUCID 帮你先冷静下来，看清操控方式，再选择安全的下一步，而且不会通知对方。",
          trust: ["不会发送消息", "不会自动报警", "不会责怪你", "动作由你控制"],
          start: "进入冷静模式",
          cases: "查看案例",
          metrics: ["Google Cloud Gemini", "MongoDB 模式记忆", "Bodyguard Mode"],
          why: "为什么很多人不敢搜索",
          whyTitle: "很多骗局会先让受害者觉得自己是孤立的。",
          pressure: [
            ["01", "恐惧", "“你会被拘留。” 恐慌会让核实真相变得像危险行为。"],
            ["02", "隔离", "“不要告诉任何人。” 骗子切断你最安全的求助渠道。"],
            ["03", "紧迫", "“你只有两小时。” 速度被用来关掉判断力。"]
          ],
          demoDescriptions: [
            "普通催促，没有权威、保密、转账或验证码要求。",
            "退款消息混合紧迫感、品牌权威、链接和银行卡验证。",
            "高风险权威骗局，使用恐惧、隔离、法律威胁和大额转账要求。"
          ]
        }
      : {
          signals: [
            "AUTHORITY CLAIM",
            "LEGAL THREAT",
            "SECRECY PRESSURE",
            "PAYMENT DEMAND",
            "IDENTITY LEVERAGE",
            "URGENCY"
          ],
          trace: [
            ["Isolation", "Do not tell family"],
            ["Authority", "Embassy / police claim"],
            ["Demand", "RM650,000 within two hours"]
          ],
          eyebrow: "Cognitive safety agent v1.0",
          title: "You are allowed to pause.",
          body:
            "If someone says you will be punished for telling another person, that pressure is the signal. LUCID helps you slow down, see the manipulation, and choose a safe next step without notifying the sender.",
          trust: ["No messages sent", "No automatic reports", "No blame", "User-controlled actions"],
          start: "Start with Calm Mode",
          cases: "View cases",
          metrics: ["Google Cloud Gemini", "MongoDB Pattern Memory", "Bodyguard Mode"],
          why: "Why people do not search",
          whyTitle: "Scams often work by making the victim feel alone.",
          pressure: [
            ["01", "Fear", "“You will be arrested.” Panic makes verification feel dangerous."],
            ["02", "Isolation", "“Do not tell anyone.” The scammer cuts off the safest source of help."],
            ["03", "Urgency", "“You have two hours.” Speed is used to shut down judgment."]
          ],
          demoDescriptions: demoCases.map((demo) => demo.description)
        };

  return (
    <main>
      <section className="hero" id="home">
        <div className="hero-bg" aria-hidden="true">
          <div className="signal-grid">
            {copy.signals.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="incident-visual">
            {copy.trace.map(([label, body], index) => (
              <div className={index === 1 ? "trace-row" : "trace-row critical"} key={label}>
                <b>{label}</b>
                <span>{body}</span>
              </div>
            ))}
          </div>
        </div>

        <SiteNav />

        <div className="hero-content">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="hero-copy">{copy.body}</p>
          <div className="trust-strip">
            {copy.trust.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="hero-actions">
            <a className="launch" href="/agent">
              {copy.start}
            </a>
            <a className="secondary-link" href="/cases">
              {copy.cases}
            </a>
          </div>
        </div>

        <div className="hero-metrics">
          {copy.metrics.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="case-band">
        <div className="section-intro">
          <p className="eyebrow">{copy.why}</p>
          <h2>{copy.whyTitle}</h2>
        </div>
        <div className="pressure-grid">
          {copy.pressure.map(([number, title, body]) => (
            <article key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <div className="case-grid">
          {demoCases.map((demo, index) => (
            <a key={demo.id} className="case-tile" href="/cases">
              <span className="case-index">0{index + 1}</span>
              <strong>{demo.title}</strong>
              <p>{copy.demoDescriptions[index]}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
