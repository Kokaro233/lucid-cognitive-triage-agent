"use client";

import { LucidConsole } from "@/components/LucidConsole";
import { useLanguage } from "@/components/LanguageProvider";
import { SiteNav } from "@/components/SiteNav";

export default function AgentPage() {
  const { language } = useLanguage();
  const copy =
    language === "zh"
      ? {
          eyebrow: "先进入冷静模式",
          title: "上传之前，先把 30 秒拿回来。",
          body:
            "LUCID 不会发送消息、联系对方、报警或责怪你。如果有人告诉你不要给别人看，这正是你可以在这里暂停的原因。"
        }
      : {
          eyebrow: "Calm Mode first",
          title: "Before you upload anything, take back 30 seconds.",
          body:
            "LUCID will not send messages, contact the sender, alert authorities, or judge you. If someone told you not to show anyone, that is exactly why you are allowed to pause here."
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
      <LucidConsole />
    </main>
  );
}
