import { expandSearchQueries } from "@/lib/trackapp-smart-search/keyword-expansion";

const STOP_WORDS = new Set([
  "app",
  "apps",
  "application",
  "mobile",
  "iphone",
  "ios",
  "store",
  "avec",
  "sans",
  "pour",
  "dans",
  "une",
  "des",
  "les",
  "son",
  "ses",
  "sur",
  "par",
  "est",
  "qui",
  "que",
  "abo",
  "abonnement",
  "jour",
  "mois",
  "min",
  "version",
  "premium",
  "simple",
  "rapide",
  "meilleur",
  "meilleure",
  "createur",
  "createurs",
  "créateur",
  "créateurs",
  "solo",
  "check",
]);

function normalizeToken(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

const FITNESS_REFERENCE_QUERIES = [
  "apple watch fitness",
  "health tracking workout",
  "activity tracker",
] as const;

/** Extrait des requêtes App Store à partir du concept décrit par l'utilisateur. */
export function buildReferenceSearchQueries(concept: string, projectName?: string): string[] {
  const fitnessTracking =
    /apple\s*watch|watchos|wearable|tracking|tracker|sant[eé]|health|bevel|gentler|workout|fitness/i.test(
      concept,
    );

  const cleaned = concept
    .replace(/[€$—–\-,;:.!?()[\]"']/g, " ")
    .replace(/\d+[,\.]?\d*\s*(€|eur|mois|usd)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned
    .split(/\s+/)
    .map(normalizeToken)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  const terms = new Set<string>();

  if (tokens.length >= 2) {
    terms.add(tokens.slice(0, 3).join(" "));
    terms.add(tokens.slice(0, 2).join(" "));
  }
  if (tokens[0]) terms.add(tokens[0]);

  for (const token of tokens.slice(0, 6)) {
    terms.add(token);
    for (const expanded of expandSearchQueries(token)) {
      if (expanded !== token) terms.add(expanded);
    }
  }

  const name = projectName?.trim();
  if (name && name.length >= 3) {
    const nameCore = normalizeToken(name.replace(/\b(pro|ai|app|plus|lab)\b/gi, " ").trim());
    const conceptNorm = normalizeToken(concept);
    // Nom de marque seul → requête trop bruitée (homonymes App Store).
    if (nameCore.length >= 3 && conceptNorm.includes(nameCore)) {
      terms.add(nameCore);
    }
  }

  if (fitnessTracking) {
    for (const q of FITNESS_REFERENCE_QUERIES) terms.add(q);
  }

  return [...terms].filter(Boolean).slice(0, 8);
}
