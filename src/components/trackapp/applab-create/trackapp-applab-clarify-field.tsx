"use client";

import type { ClarifyFlowQuestion } from "@/lib/trackapp-applab-create/clarify-flow";

export function TrackappApplabClarifyField({
  question,
  draft,
  onDraftChange,
  disabled,
  onSubmit,
  canSubmit,
}: Readonly<{
  question: ClarifyFlowQuestion;
  draft: string;
  onDraftChange: (value: string) => void;
  disabled?: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
}>) {
  return (
    <div className="ta-applab-clarify-field">
      <textarea
        id={`clarify-flow-${question.id}`}
        className="ta-applab-glass-panel__field ta-applab-glass-panel__field--area ta-applab-clarify-field__input"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={question.placeholder}
        rows={3}
        maxLength={600}
        disabled={disabled}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />

      <p className="ta-applab-clarify-field__hint">
        Réponse libre — min. {question.minLength} caractères. ⌘/Ctrl + Entrée pour continuer.
      </p>
    </div>
  );
}
