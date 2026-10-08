export const APPLAB_MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export function applabMotionTransition(reduceMotion: boolean | null, duration = 0.52) {
  if (reduceMotion) return { duration: 0 };
  return { duration, ease: APPLAB_MOTION_EASE };
}

export function applabLayoutTransition(reduceMotion: boolean | null, duration = 0.22) {
  if (reduceMotion) return { duration: 0 };
  return { duration, ease: APPLAB_MOTION_EASE };
}

/** Entrée des étapes avancées (clarify, assessment…) — pas de blur agressif. */
export const applabPanelStepMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
} as const;

export function applabFieldTransition(reduceMotion: boolean | null, duration = 0.24) {
  if (reduceMotion) return { duration: 0 };
  return { duration, ease: APPLAB_MOTION_EASE };
}

/** Crossfade interne des champs (nom → concept → questions…). */
export const applabFieldLayerMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

export const applabBelowMotion = {
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 28 },
} as const;
