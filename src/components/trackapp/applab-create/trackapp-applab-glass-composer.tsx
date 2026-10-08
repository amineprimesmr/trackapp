"use client";

import { AnimatePresence, motion } from "framer-motion";

import { TrackappApplabComposerSubmit } from "@/components/trackapp/applab-create/trackapp-applab-composer-submit";
import {
  applabFieldLayerMotion,
  applabFieldTransition,
} from "@/lib/trackapp-applab-create/step-motion";
import { cn } from "@/lib/utils";

export function TrackappApplabGlassComposer({
  expanded = false,
  area = false,
  stacked = false,
  fieldKey,
  canContinue,
  onContinue,
  continueLabel = "Continuer",
  busy = false,
  hideSubmit = false,
  reduceMotion,
  footer,
  children,
}: Readonly<{
  expanded?: boolean;
  area?: boolean;
  stacked?: boolean;
  fieldKey?: string;
  canContinue: boolean;
  onContinue: () => void;
  continueLabel?: string;
  busy?: boolean;
  hideSubmit?: boolean;
  reduceMotion: boolean | null;
  footer?: React.ReactNode;
  children: React.ReactNode;
}>) {
  const fieldTransition = applabFieldTransition(reduceMotion);
  const layerKey = fieldKey ?? "glass-field";
  const reserveCtaSpace = area || expanded;

  return (
    <div className="ta-applab-composer-slot">
      <div
        className={cn(
          "ta-applab-glass-panel",
          expanded ? "ta-applab-glass-panel--expanded" : "ta-applab-glass-panel--compact",
          stacked && "ta-applab-glass-panel--stacked",
        )}
      >
        <div className={cn("ta-applab-glass-panel__body", stacked && "ta-applab-glass-panel__body--stack")}>
          <div
            className={cn(
              "ta-applab-glass-panel__editor",
              "ta-applab-glass-panel__editor--morph",
              reserveCtaSpace && "ta-applab-glass-panel__editor--cta-space",
              (area || expanded) && "ta-applab-glass-panel__editor--area",
              stacked && "ta-applab-glass-panel__editor--scroll",
            )}
          >
            <AnimatePresence mode="sync" initial={false}>
              <motion.div
                key={layerKey}
                className="ta-applab-glass-panel__field-layer"
                {...applabFieldLayerMotion}
                transition={fieldTransition}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          {hideSubmit ? null : (
            <div
              className={cn(
                "ta-applab-glass-panel__cta-bar",
                stacked && "ta-applab-glass-panel__cta-bar--stack",
              )}
            >
              <TrackappApplabComposerSubmit
                disabled={!canContinue}
                busy={busy}
                onClick={onContinue}
                label={continueLabel}
              />
            </div>
          )}
        </div>

        {footer ? <div className="ta-applab-glass-panel__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
