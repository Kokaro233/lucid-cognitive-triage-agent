"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { SiteNav } from "@/components/SiteNav";
import { demoCases } from "@/data/demoCases";

export default function CasesPage() {
  const { language } = useLanguage();
  const [activeFilter, setActiveFilter] = useState("all");
  const copy =
    language === "zh"
      ? {
          eyebrow: "案例库",
          title: "用于测试、演示和评审的脱敏场景。",
          analyze: "进入 Agent 分析",
          fallback: "素材位置",
          filters: [
            ["all", "全部"],
            ["low", "低风险"],
            ["refund", "退款钓鱼"],
            ["authority", "权威威胁"],
            ["social", "社交账号"],
            ["investment", "投资诈骗"]
          ],
          titles: {
            "low-risk-checkin": "低风险提醒",
            "airline-refund": "航空退款钓鱼",
            "embassy-police": "假大使馆 / 公安骗局",
            "whatsapp-security-phishing": "WhatsApp 安全中心钓鱼",
            "investment-hype": "加密投资宣传页"
          },
          descriptions: {}
        }
      : {
          eyebrow: "Case library",
          title: "Desensitized scenarios for demo, testing, and judging.",
          analyze: "Analyze in agent",
          fallback: "Drop image",
          filters: [
            ["all", "All"],
            ["low", "Low risk"],
            ["refund", "Refund phishing"],
            ["authority", "Authority threat"],
            ["social", "Social account"],
            ["investment", "Investment scam"]
          ],
          titles: Object.fromEntries(demoCases.map((demo) => [demo.id, demo.title])),
          descriptions: {}
        };

  const categories: Record<string, string[]> = {
    "low-risk-checkin": ["low"],
    "airline-refund": ["refund"],
    "embassy-police": ["authority"],
    "whatsapp-security-phishing": ["social"],
    "investment-hype": ["investment"]
  };
  const filteredCases = useMemo(
    () =>
      activeFilter === "all"
        ? demoCases
        : demoCases.filter((demo) => categories[demo.id]?.includes(activeFilter)),
    [activeFilter]
  );

  return (
    <main>
      <section className="page-hero compact-hero">
        <SiteNav />
        <div className="page-heading">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
        </div>
      </section>
      <section className="case-band standalone">
        <div className="filter-row">
          {copy.filters.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={activeFilter === id ? "active" : ""}
              onClick={() => setActiveFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="case-grid">
          {filteredCases.map((demo, index) => (
            <article className="case-tile case-detail" key={demo.id}>
              <span className="case-index">0{index + 1}</span>
              <strong>{copy.titles[demo.id]}</strong>
              {demo.image || demo.images ? (
                <div className={demo.images && demo.images.length > 1 ? "case-image multi" : "case-image"}>
                  {(demo.images ?? (demo.image ? [demo.image] : [])).map((image, imageIndex) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={image} src={image} alt={`${demo.title} screenshot ${imageIndex + 1}`} />
                  ))}
                </div>
              ) : (
                <div className="case-placeholder">{copy.fallback}: public/cases/case-0{index + 1}.png</div>
              )}
              <a className="case-link" href={`/agent?case=${encodeURIComponent(demo.id)}`}>
                {copy.analyze}
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
