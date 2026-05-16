"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type SavedReview = {
  id: string;
  savedAt: string;
  scenario: string;
  riskLevel: string;
  score: number;
  summary: string;
  safeReply: string;
  evidenceSummary: string;
  evidence: string[];
  imageCount: number;
  inputPreview: string;
};

const SAVED_REVIEWS_KEY = "lucid-saved-reviews";

export function SavedReviews() {
  const { language } = useLanguage();
  const [reviews, setReviews] = useState<SavedReview[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_REVIEWS_KEY);
      setReviews(saved ? (JSON.parse(saved) as SavedReview[]) : []);
    } catch {
      setReviews([]);
    }
  }, []);

  function clearAll() {
    window.localStorage.removeItem(SAVED_REVIEWS_KEY);
    setReviews([]);
    setOpenId(null);
  }

  function persist(nextReviews: SavedReview[]) {
    setReviews(nextReviews);
    window.localStorage.setItem(SAVED_REVIEWS_KEY, JSON.stringify(nextReviews));
  }

  function deleteReview(id: string) {
    const nextReviews = reviews.filter((review) => review.id !== id);
    persist(nextReviews);
    if (openId === id) setOpenId(null);
  }

  const copy =
    language === "zh"
      ? {
          empty: "还没有保存记录。完成一次复核后，可以在结果页保存当下这次复核。",
          openAgent: "开始一次复核",
          openCases: "查看案例",
          saved: "保存时间",
          images: "张截图",
          clear: "清空记录",
          view: "查看详情",
          hide: "收起详情",
          delete: "删除这条",
          safeReply: "安全回复",
          evidence: "证据摘要",
          evidenceItems: "证据片段"
        }
      : {
          empty: "No saved reviews yet. After a review, save the current result from the agent page.",
          openAgent: "Start a review",
          openCases: "View cases",
          saved: "Saved",
          images: "image(s)",
          clear: "Clear saved reviews",
          view: "View details",
          hide: "Hide details",
          delete: "Delete this",
          safeReply: "Safe reply",
          evidence: "Evidence summary",
          evidenceItems: "Evidence items"
        };

  if (reviews.length === 0) {
    return (
      <section className="case-band standalone">
        <article className="panel saved-empty">
          <div>
            <span>0</span>
            <p>{copy.empty}</p>
          </div>
          <div className="saved-empty-actions">
            <a href="/agent">{copy.openAgent}</a>
            <a href="/cases">{copy.openCases}</a>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="case-band standalone">
      <div className="saved-toolbar">
        <span>{reviews.length} saved</span>
        <button type="button" onClick={clearAll}>
          {copy.clear}
        </button>
      </div>
      <div className="saved-page-grid">
        {reviews.map((review) => (
          <article className={`panel saved-page-card ${openId === review.id ? "open" : ""}`} key={review.id}>
            <div className="saved-card-top">
              <strong>{review.scenario}</strong>
              <span className={`saved-risk-badge ${review.riskLevel.toLowerCase()}`}>
                <small>{review.riskLevel}</small>
                <b>{review.score}</b>
              </span>
            </div>
            <p className="save-status">
              {copy.saved}: {review.savedAt}
              {review.imageCount > 0 ? ` · ${review.imageCount} ${copy.images}` : ""}
            </p>
            <p>{review.summary}</p>
            {review.inputPreview && <p className="quote">"{review.inputPreview}"</p>}
            <div className="saved-card-actions">
              <button type="button" onClick={() => setOpenId(openId === review.id ? null : review.id)}>
                {openId === review.id ? copy.hide : copy.view}
              </button>
              <button type="button" className="danger" onClick={() => deleteReview(review.id)}>
                {copy.delete}
              </button>
            </div>
            {openId === review.id && (
              <div className="saved-detail">
                <h3>{copy.safeReply}</h3>
                <p>{review.safeReply}</p>
                <h3>{copy.evidence}</h3>
                <p>{review.evidenceSummary}</p>
                {review.evidence.length > 0 && (
                  <>
                    <h3>{copy.evidenceItems}</h3>
                    <ul>
                      {review.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
