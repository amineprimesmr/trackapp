"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildUnderstandingFromClarifyFlow,
  canSubmitClarifyAnswer,
  getClarifyFlowProgress,
  getLastAnsweredClarifyId,
  getNextClarifyFlowQuestion,
  type ClarifyFlowAnswers,
} from "@/lib/trackapp-applab-create/clarify-flow";
import type { ApplabConceptUnderstanding } from "@/lib/trackapp-applab-project/types";
import { cn } from "@/lib/utils";

import "@/styles/trackapp-applab-clarify-wizard.css";

type Props = Readonly<{
  name: string;
  concept: string;
  answers: ClarifyFlowAnswers;
  onAnswersChange: (answers: ClarifyFlowAnswers) => void;
  onReady: (understanding: ApplabConceptUnderstanding) => void;
  onLoadingChange?: (loading: boolean) => void;
}>;

export function TrackappApplabClarifyWizard({
  name,
  concept,
  answers,
  onAnswersChange,
  onReady,
  onLoadingChange,
}: Props) {
  const ctx = useMemo(() => ({ name, concept, answers }), [name, concept, answers]);
  const current = useMemo(() => getNextClarifyFlowQuestion(ctx), [ctx]);
  const progress = useMemo(() => getClarifyFlowProgress(ctx), [ctx]);

  const [draft, setDraft] = useState("");
  const [finishing, setFinishing] = useState(false);

  const finish = useCallback(() => {
    if (finishing) return;
    setFinishing(true);
    onLoadingChange?.(true);
    const understanding = buildUnderstandingFromClarifyFlow(name, concept, answers);
    void Promise.resolve().then(() => {
      onReady(understanding);
      setFinishing(false);
      onLoadingChange?.(false);
    });
  }, [answers, concept, finishing, name, onLoadingChange, onReady]);

  useEffect(() => {
    if (!current && progress.done > 0 && !finishing) {
      finish();
    }
  }, [current, finish, finishing, progress.done]);

  useEffect(() => {
    if (!current) {
      setDraft("");
      return;
    }
    const saved = answers[current.id];
    setDraft(saved && saved !== "__skipped__" ? saved : "");
  }, [current, answers]);

  const canContinue = current ? canSubmitClarifyAnswer(current, draft) : false;

  const goNext = useCallback(() => {
    if (!current || !canContinue) return;

    const nextAnswers = { ...answers, [current.id]: draft.trim() };
    onAnswersChange(nextAnswers);
    setDraft("");
  }, [answers, canContinue, current, draft, onAnswersChange]);

  const goPrev = useCallback(() => {
    const lastId = getLastAnsweredClarifyId(ctx);
    if (!lastId) return;
    const trimmed = { ...answers };
    delete trimmed[lastId];
    onAnswersChange(trimmed);
  }, [answers, ctx, onAnswersChange]);

  if (!current) {
    return (
      <p className="ta-clarify-wizard__loading" aria-busy="true">
        {finishing ? "Préparation de la synthèse…" : "Chargement…"}
      </p>
    );
  }

  return (
    <div className="ta-clarify-wizard ta-clarify-wizard--open">
      <div className="ta-clarify-wizard__progress" aria-hidden>
        <div className="ta-clarify-wizard__progress-track">
          <span
            className="ta-clarify-wizard__progress-fill"
            style={{ width: `${((progress.done + 1) / progress.total) * 100}%` }}
          />
        </div>
      </div>

      <div className="ta-clarify-wizard__card">
        <h2 className="ta-clarify-wizard__question">{current.question}</h2>

        <textarea
          id={`clarify-flow-${current.id}`}
          className="ta-applab-studio__composer-textarea ta-clarify-wizard__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={current.placeholder}
          rows={4}
          maxLength={600}
          disabled={finishing}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canContinue) {
              e.preventDefault();
              goNext();
            }
          }}
        />

        <p className="ta-clarify-wizard__hint">
          Réponse libre — min. {current.minLength} caractères. ⌘/Ctrl + Entrée pour continuer.
        </p>
      </div>

      <div className="ta-clarify-wizard__actions">
        <button
          type="button"
          className="ta-applab-studio__btn ta-applab-studio__btn--back"
          onClick={goPrev}
          disabled={progress.done === 0 || finishing}
        >
          Retour
        </button>
        <button
          type="button"
          className={cn(
            "ta-applab-studio__btn ta-applab-studio__btn--primary ta-applab-studio__btn--sentence",
          )}
          disabled={!canContinue || finishing}
          onClick={goNext}
        >
          {!finishing ? <span aria-hidden>✦</span> : null}
          {finishing ? "Synthèse…" : "Continuer"}
        </button>
      </div>
    </div>
  );
}
