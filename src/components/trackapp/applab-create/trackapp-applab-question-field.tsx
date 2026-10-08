"use client";

import type { CreateQuestionField } from "@/lib/trackapp-applab-create/create-questions";

export function TrackappApplabQuestionField({
  field,
  draft,
  onDraftChange,
  onSubmit,
  canSubmit,
}: Readonly<{
  field: CreateQuestionField;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
}>) {
  return (
    <div className="ta-applab-clarify-field">
      <textarea
        id={`applab-${field.id}`}
        className="ta-applab-glass-panel__field ta-applab-glass-panel__field--area ta-applab-clarify-field__input"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={field.placeholder}
        rows={field.rows}
        maxLength={field.maxLength}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && canSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
    </div>
  );
}
