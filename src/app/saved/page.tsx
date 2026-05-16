"use client";

import { SavedReviews } from "@/components/SavedReviews";
import { SiteNav } from "@/components/SiteNav";
import { useLanguage } from "@/components/LanguageProvider";

export default function SavedPage() {
  const { language } = useLanguage();
  const copy =
    language === "zh"
      ? {
          eyebrow: "本机记忆",
          title: "你的保存记录只留在这台设备。",
          body: "这里用来回看你主动保存过的复核结果。LUCID 不会把完整私人聊天上传到这里。"
        }
      : {
          eyebrow: "Local memory",
          title: "Your saved reviews stay on this device.",
          body: "Review the results you chose to save. LUCID does not upload full private chats into this history."
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
      <SavedReviews />
    </main>
  );
}
