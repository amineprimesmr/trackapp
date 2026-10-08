"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  APPLAB_MVP_STACK,
  type ApplabCreateConstraints,
  type ApplabMvpPromptBundle,
  type ApplabPromptVersion,
} from "@/lib/trackapp-applab-create/mvp-prompt-types";
import {
  buildClaudeCodeDeeplink,
  buildCursorPromptDeeplink,
  CLAUDE_Q_PARAM_MAX,
  CURSOR_PROMPT_PARAM_MAX,
  truncatePromptForDeeplink,
} from "@/lib/trackapp-clone-prompt/deeplinks";
import {
  readPreferredIde,
  writePreferredIde,
} from "@/lib/trackapp-clone-prompt/preferences";
import type { TrackappPreferredIde } from "@/lib/trackapp-clone-prompt/types";
import type {
  ApplabConceptAnswers,
  ApplabConceptAssessment,
  ApplabConceptUnderstanding,
  ApplabClarifyingQuestion,
} from "@/lib/trackapp-applab-project/types";
import { cn } from "@/lib/utils";

type Toast = { message: string } | null;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function deeplinkSuffix(length: number): string {
  return `[…] Prompt complet AppLAB (${length} car.) — utilise Copier pour la version intégrale.`;
}

function qualityTone(score: number): string {
  if (score >= 85) return "is-excellent";
  if (score >= 65) return "is-good";
  return "is-low";
}

export function TrackappApplabMvpPromptExport({
  name,
  concept,
  understanding,
  assessment,
  answers,
  questions,
  constraints,
  referenceAppId,
  referenceCountry,
  promptVersions,
  activeVersionId,
  onVersionAdded,
  onActiveVersionChange,
  onLoadingChange,
  onSyncVersion,
  onPromptTextChange,
}: Readonly<{
  name: string;
  concept: string;
  understanding: ApplabConceptUnderstanding;
  assessment: ApplabConceptAssessment;
  answers: ApplabConceptAnswers;
  questions: readonly ApplabClarifyingQuestion[];
  constraints: ApplabCreateConstraints;
  referenceAppId: string | null;
  referenceCountry: string;
  promptVersions: readonly ApplabPromptVersion[];
  activeVersionId: string | null;
  onVersionAdded: (version: ApplabPromptVersion) => void;
  onActiveVersionChange: (id: string) => void;
  onLoadingChange?: (busy: boolean) => void;
  onSyncVersion?: (version: ApplabPromptVersion) => void;
  /** Sync texte affiché (carte « Prompt Xcode » au-dessus) pendant/après génération. */
  onPromptTextChange?: (fullPrompt: string) => void;
}>) {
  const [bundle, setBundle] = useState<ApplabMvpPromptBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [preferredIde, setPreferredIde] = useState<TrackappPreferredIde>("cursor");
  const [showPreview, setShowPreview] = useState(false);
  const autoGenRef = useRef(false);

  const activeVersion = useMemo(
    () => promptVersions.find((v) => v.id === activeVersionId) ?? promptVersions[0] ?? null,
    [activeVersionId, promptVersions],
  );

  useEffect(() => {
    setPreferredIde(readPreferredIde());
  }, []);

  const setBusy = useCallback(
    (busy: boolean) => {
      setLoading(busy);
      onLoadingChange?.(busy);
    },
    [onLoadingChange],
  );

  const showToast = useCallback((message: string) => {
    setToast({ message });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const generate = useCallback(
    async (force = false) => {
      if (!force && activeVersion && activeVersion.stack === APPLAB_MVP_STACK && promptVersions.length > 0) {
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const versionNumber = promptVersions.length + 1;
        const versionId = crypto.randomUUID();

        const res = await fetch("/api/trackapp/applab/mvp-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            concept,
            stack: APPLAB_MVP_STACK,
            understanding,
            assessment,
            answers,
            questions,
            constraints,
            referenceAppId,
            referenceCountry,
            versionNumber,
            versionId,
          }),
        });
        const data = (await res.json()) as { bundle?: ApplabMvpPromptBundle; error?: string };
        if (!res.ok || !data.bundle) {
          throw new Error(data.error ?? "Génération impossible");
        }

        setBundle(data.bundle);
        const version = data.bundle.promptVersion;
        onVersionAdded(version);
        onPromptTextChange?.(version.fullPrompt);
        onSyncVersion?.(version);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur réseau");
      } finally {
        setBusy(false);
      }
    },
    [
      activeVersion,
      answers,
      assessment,
      concept,
      constraints,
      name,
      onPromptTextChange,
      onSyncVersion,
      onVersionAdded,
      promptVersions.length,
      questions,
      referenceAppId,
      referenceCountry,
      setBusy,
      understanding,
    ],
  );

  useEffect(() => {
    if (autoGenRef.current) return;
    if (promptVersions.length === 0 && understanding && assessment) {
      autoGenRef.current = true;
      void generate(true);
    }
  }, [assessment, generate, promptVersions.length, understanding]);

  const displayVersion = useMemo(() => {
    const selected = promptVersions.find((v) => v.id === activeVersionId);
    return selected ?? bundle?.promptVersion ?? promptVersions[0] ?? null;
  }, [activeVersionId, bundle?.promptVersion, promptVersions]);

  const fullPrompt = displayVersion?.fullPrompt ?? "";
  const quality = displayVersion?.quality;

  useEffect(() => {
    onPromptTextChange?.(fullPrompt);
  }, [fullPrompt, onPromptTextChange]);

  const handleCopy = async () => {
    if (!fullPrompt) return;
    const ok = await copyText(fullPrompt);
    showToast(ok ? "Prompt copié" : "Copie impossible");
  };

  const openIde = (ide: TrackappPreferredIde) => {
    if (!fullPrompt) return;
    writePreferredIde(ide);
    setPreferredIde(ide);
    const suffix = deeplinkSuffix(fullPrompt.length);
    const max = ide === "claude" ? CLAUDE_Q_PARAM_MAX : CURSOR_PROMPT_PARAM_MAX;
    const snippet = truncatePromptForDeeplink(fullPrompt, max - 20, suffix);
    window.location.href =
      ide === "claude" ?
        buildClaudeCodeDeeplink(snippet)
      : buildCursorPromptDeeplink(snippet, false);
  };

  const ready = Boolean(fullPrompt) && !loading;

  return (
    <div className="ta-applab-mvp-prompt">
      <div className="ta-applab-mvp-prompt__intro">
        <p className="ta-applab-mvp-prompt__kicker">Prompt App Store complet</p>
        <p className="ta-applab-mvp-prompt__lead">
          Un seul prompt ultra-complet pour une **app v1.0 production-ready** : spec produit, funnel UX,
          ressources Trackapp, architecture SwiftUI, conformité Apple et checklist soumission.
          {referenceAppId ? " Référence concurrente incluse." : ""}
        </p>
      </div>

      {quality ? (
        <div className={cn("ta-applab-mvp-prompt__quality", qualityTone(quality.score))}>
          <div className="ta-applab-mvp-prompt__quality-head">
            <span className="ta-applab-mvp-prompt__quality-score">{quality.score}%</span>
            <span className="ta-applab-mvp-prompt__quality-label">Score qualité prompt</span>
          </div>
          <ul className="ta-applab-mvp-prompt__quality-checks">
            {quality.checks.map((c) => (
              <li key={c.id} className={cn(c.pass && "is-pass")}>
                {c.pass ? "✓" : "○"} {c.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="ta-applab-mvp-prompt__stack ta-applab-mvp-prompt__stack--fixed">
        <p className="ta-applab-mvp-prompt__stack-legend">Stack</p>
        <div className="ta-applab-mvp-prompt__stack-badge">
          <span className="ta-applab-mvp-prompt__stack-title">SwiftUI + Firebase + RevenueCat</span>
          <span className="ta-applab-mvp-prompt__stack-desc">Stack imposée AppLAB — aucun choix techno</span>
        </div>
      </div>

      {loading ? (
        <div className="ta-applab-mvp-prompt__loading">
          <span className="ta-applab-mvp-prompt__spinner" aria-hidden />
          <p>Génération du prompt App Store… (30–90 s)</p>
        </div>
      ) : null}

      {error ? (
        <div className="ta-applab-mvp-prompt__error" role="alert">
          <p>{error}</p>
          <button type="button" className="ta-applab-mvp-prompt__retry" onClick={() => void generate(true)}>
            Réessayer la génération
          </button>
        </div>
      ) : null}

      {ready ? (
        <>
          <div className="ta-applab-mvp-prompt__actions ta-applab-mvp-prompt__actions--primary">
            <button
              type="button"
              className="ta-applab-studio__btn ta-applab-studio__btn--ghost"
              onClick={() => void handleCopy()}
            >
              Copier
            </button>
            <button
              type="button"
              className={cn(
                "ta-applab-studio__btn ta-applab-studio__btn--ghost",
                preferredIde === "cursor" && "is-preferred",
              )}
              onClick={() => openIde("cursor")}
            >
              Cursor
            </button>
            <button
              type="button"
              className={cn(
                "ta-applab-studio__btn ta-applab-studio__btn--ghost",
                preferredIde === "claude" && "is-preferred",
              )}
              onClick={() => openIde("claude")}
            >
              Claude
            </button>
          </div>

          <button
            type="button"
            className="ta-applab-mvp-prompt__toggle"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Masquer l'aperçu" : "Aperçu du prompt"}
          </button>

          {showPreview ? (
            <pre className="ta-applab-mvp-prompt__body">{fullPrompt}</pre>
          ) : (
            <p className="ta-applab-mvp-prompt__hint">
              {fullPrompt.length.toLocaleString("fr-FR")} caractères · SwiftUI + Xcode
            </p>
          )}
        </>
      ) : null}

      {toast ? (
        <p className="ta-applab-mvp-prompt__toast" role="status">
          {toast.message}
        </p>
      ) : null}
    </div>
  );
}
