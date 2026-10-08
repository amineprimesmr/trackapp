"use client";

import type { ApplabCreateStepId } from "@/lib/trackapp-applab-create/types";

import { TrackappApplabGlassComposer } from "@/components/trackapp/applab-create/trackapp-applab-glass-composer";

export function TrackappApplabIntroComposer({
  step,
  name,
  concept,
  onNameChange,
  onConceptChange,
  onContinue,
  canContinue,
  reduceMotion,
}: Readonly<{
  step: Extract<ApplabCreateStepId, "name" | "concept">;
  name: string;
  concept: string;
  onNameChange: (value: string) => void;
  onConceptChange: (value: string) => void;
  onContinue: () => void;
  canContinue: boolean;
  reduceMotion: boolean | null;
}>) {
  const isName = step === "name";

  return (
    <TrackappApplabGlassComposer
      expanded={!isName}
      area={!isName}
      fieldKey={step}
      canContinue={canContinue}
      onContinue={onContinue}
      reduceMotion={reduceMotion}
    >
      {isName ? (
        <input
          id="applab-name"
          className="ta-applab-glass-panel__field"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Lancer mon app"
          maxLength={80}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canContinue) {
              e.preventDefault();
              onContinue();
            }
          }}
        />
      ) : (
        <textarea
          id="applab-concept"
          className="ta-applab-glass-panel__field ta-applab-glass-panel__field--area"
          value={concept}
          onChange={(e) => onConceptChange(e.target.value)}
          placeholder="Ex. App d'apprentissage de l'arabe pour francophones — leçons courtes, quiz, streaks."
          maxLength={280}
          rows={3}
          autoFocus
        />
      )}
    </TrackappApplabGlassComposer>
  );
}
