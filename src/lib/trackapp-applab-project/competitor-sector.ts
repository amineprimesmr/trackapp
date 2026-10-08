import type { SearchResultWithTrackappMetrics } from "@/lib/trackapp-app-display-metrics";
import type { ApplabConceptUnderstanding } from "@/lib/trackapp-applab-project/types";

/** Nombre cible de concurrents affichés et comptabilisés dans la synthèse. */
export const APPLAB_COMPETITOR_TARGET = 8;

/** Apps sport/fitness tracking (Bevel, Strava…) — pas streaming ni scores live (DAZN, NBA…). */
const FITNESS_TRACKING_PATTERN =
  /apple\s*watch|watchos|wearable|tracking|tracker|sant[eé]|health\s*data|\bdta\b|bevel|gentler|recovery|hrv|heart\s*rate|frequence\s*cardiaque|activit[eé]|steps|podometre|pedometer|entrainement|entraînement|workout|muscu|fitness/i;

const FITNESS_STRONG_KEYWORDS = [
  "fitness",
  "workout",
  "running",
  "tracker",
  "tracking",
  "health",
  "steps",
  "activity",
  "training",
  "yoga",
  "calorie",
  "marathon",
  "cardio",
  "wearable",
  "watch",
  "strava",
  "recovery",
  "wellness",
  "coach",
  "entrainement",
  "entraînement",
] as const;

const SPORTS_MEDIA_ANTI_KEYWORDS = [
  "live stream",
  "watch live",
  "broadcast",
  "highlights",
  "diffusion",
  "regarder",
  "match replay",
  "sports news",
  "league pass",
  "game pass",
  "football scores",
  "soccer scores",
  "live sport",
  "sport tv",
] as const;

const SPORTS_MEDIA_BRAND_PATTERN =
  /\b(dazn|nba\b|espn|eurosport|bein\s*sport|f1\s*tv|mlb|nfl|nhl|onefootball|sofascore|fotmob|bleacher|dazn|skysports|fox\s*sports)\b/i;

type SectorRule = Readonly<{
  pattern: RegExp;
  categories: readonly string[];
  keywords: readonly string[];
  strongKeywords?: readonly string[];
  antiKeywords?: readonly string[];
  excludeCategories?: readonly string[];
  searchQueries?: readonly string[];
  notCompetitors?: readonly string[];
  mustMatch?: readonly string[];
  requireStrongKeyword?: boolean;
  priority?: number;
}>;

const EDUCATION_STRONG_KEYWORDS = [
  "learn",
  "language",
  "vocabulary",
  "course",
  "lesson",
  "alphabet",
  "grammar",
  "flashcard",
  "tutor",
  "education",
  "apprendre",
  "langue",
  "cours",
] as const;

const FINANCE_STRONG_KEYWORDS = [
  "budget",
  "expense",
  "finance",
  "money",
  "invest",
  "bank",
  "saving",
  "wallet",
  "crypto",
  "portfolio",
] as const;

const PHOTO_STRONG_KEYWORDS = [
  "photo",
  "video",
  "editor",
  "edit",
  "filter",
  "camera",
  "collage",
  "retouch",
] as const;

const ARABIC_QURAN_READING_PATTERN =
  /coran|quran|qur'?an|tajweed|tajwid|harakat|hijai|hijaiyah|lecture.{0,24}arabe|lire.{0,24}arabe|apprendre.{0,24}(lire|écrire|ecrire).{0,24}arabe|alphabet.{0,20}arabe|arabe.{0,20}(écrit|ecrit|lecture|lire)|musulman/i;

const ARABIC_QURAN_STRONG_KEYWORDS = [
  "arabic",
  "arabe",
  "quran",
  "coran",
  "alphabet",
  "read",
  "lire",
  "letters",
  "harakat",
  "islamic",
  "hijai",
  "tajweed",
] as const;

const SECTOR_RULES: readonly SectorRule[] = [
  {
    pattern: ARABIC_QURAN_READING_PATTERN,
    categories: ["Education", "Référence", "Books"],
    keywords: [
      "arabic",
      "arabe",
      "quran",
      "coran",
      "alphabet",
      "read",
      "lire",
      "letters",
      "harakat",
      "islamic",
      "learn",
      "apprendre",
    ],
    strongKeywords: ARABIC_QURAN_STRONG_KEYWORDS,
    antiKeywords: ["battle royale", "shooter", "casino", "slots", "dating", "social network"],
    notCompetitors: ["Duolingo", "Babbel", "Memrise", "Busuu", "TikTok", "Instagram"],
    mustMatch: ["arabic", "arabe", "quran", "coran", "alphabet", "read", "lire", "letter", "harakat"],
    searchQueries: [
      "learn read arabic alphabet",
      "quran reading app",
      "arabic letters learning",
      "learn arabic for quran",
      "lecture coran arabe débutant",
      "apprendre lire arabe francophone",
    ],
    requireStrongKeyword: true,
    priority: 11,
  },
  {
    pattern: FITNESS_TRACKING_PATTERN,
    categories: ["Health & Fitness"],
    excludeCategories: ["Sports"],
    keywords: [...FITNESS_STRONG_KEYWORDS, "sport"],
    strongKeywords: FITNESS_STRONG_KEYWORDS,
    antiKeywords: SPORTS_MEDIA_ANTI_KEYWORDS,
    notCompetitors: ["DAZN", "NBA", "ESPN", "Eurosport", "beIN SPORTS", "F1 TV", "OneFootball", "SofaScore"],
    mustMatch: ["fitness", "health", "tracking", "workout", "activity"],
    searchQueries: [
      "apple watch fitness tracker",
      "health activity tracking",
      "workout tracker app",
      "fitness recovery app",
    ],
    requireStrongKeyword: true,
    priority: 10,
  },
  {
    pattern: /arabe|langue|alphabet|vocabulaire|grammaire|duolingo|appren|leçon|cours|education|scolaire|enfant/i,
    categories: ["Education", "Référence", "Books"],
    keywords: ["arabe", "arabic", "langue", "language", "alphabet", "learn", "apprendre", "cours", "lecon"],
    strongKeywords: EDUCATION_STRONG_KEYWORDS,
    antiKeywords: ["battle royale", "shooter", "casino", "slots", "dating", "social network"],
    notCompetitors: ["TikTok", "Instagram", "Snapchat", "Candy Crush"],
    mustMatch: ["learn", "language", "course", "education"],
    searchQueries: ["language learning app", "learn vocabulary", "education flashcards", "alphabet learning"],
    requireStrongKeyword: true,
    priority: 10,
  },
  {
    pattern: /nutrition|calorie|repas|regime|régime|poids|macro|jeune|fasting|food/i,
    categories: ["Health & Fitness", "Food & Drink", "Medical"],
    keywords: ["calorie", "nutrition", "repas", "diet", "food", "macro"],
    strongKeywords: ["calorie", "nutrition", "diet", "macro", "meal", "fasting", "weight"],
    antiKeywords: ["food delivery", "restaurant order", "uber eats", "deliveroo", "recipes only"],
    searchQueries: ["calorie counter app", "nutrition tracker", "macro tracking diet", "meal planner health"],
    requireStrongKeyword: true,
    priority: 9,
  },
  {
    pattern: /medit|sommeil|sleep|mental|stress|bien.?etre|bien.?être|mindful/i,
    categories: ["Health & Fitness", "Medical", "Lifestyle"],
    keywords: ["meditation", "sleep", "mindful", "stress", "wellness"],
    strongKeywords: ["meditation", "sleep", "mindful", "stress", "wellness", "breath", "calm"],
    antiKeywords: ["news", "podcast network", "music streaming"],
    searchQueries: ["meditation app", "sleep tracker wellness", "mindfulness stress relief"],
    requireStrongKeyword: true,
    priority: 9,
  },
  {
    pattern: /finance|budget|depense|dépense|invest|crypto|banque|argent|epargne|épargne/i,
    categories: ["Finance", "Business"],
    keywords: ["budget", "finance", "money", "invest", "bank", "expense"],
    strongKeywords: FINANCE_STRONG_KEYWORDS,
    antiKeywords: ["news", "cnbc", "bloomberg", "stock news", "financial news"],
    notCompetitors: ["Bloomberg", "CNBC", "Yahoo Finance News"],
    searchQueries: ["budget expense tracker", "personal finance app", "money manager", "investing portfolio app"],
    requireStrongKeyword: true,
    priority: 9,
  },
  {
    pattern: /photo|video|vidéo|montage|camera|caméra|edit|filtre/i,
    categories: ["Photo & Video"],
    keywords: ["photo", "video", "camera", "edit", "filter"],
    strongKeywords: PHOTO_STRONG_KEYWORDS,
    antiKeywords: ["social network", "dating", "messaging", "live stream"],
    notCompetitors: ["TikTok", "Instagram", "Snapchat"],
    searchQueries: ["photo editor app", "video editor mobile", "camera filters edit"],
    requireStrongKeyword: true,
    priority: 9,
  },
  {
    pattern: /social|rencontre|dating|chat|message|communaut/i,
    categories: ["Social Networking", "Lifestyle"],
    keywords: ["social", "chat", "dating", "message", "community"],
    strongKeywords: ["dating", "match", "chat", "social", "community", "meet"],
    antiKeywords: ["photo editor", "finance", "productivity", "game"],
    searchQueries: ["dating app", "social chat community", "meet people app"],
    priority: 8,
  },
  {
    pattern: /productiv|todo|habitude|focus|pomodoro|organis|planning|agenda|note/i,
    categories: ["Productivity", "Business", "Utilities"],
    keywords: ["todo", "habit", "focus", "productivity", "planner", "organize"],
    strongKeywords: ["todo", "habit", "focus", "productivity", "planner", "notes", "tasks"],
    antiKeywords: ["game", "casino", "dating", "social network"],
    searchQueries: ["todo list app", "habit tracker productivity", "focus planner notes"],
    priority: 7,
  },
  {
    pattern: /sport|fitness|running|course|muscu|coach|entrainement|entraînement|yoga|marche|velo|vélo/i,
    categories: ["Health & Fitness", "Sports"],
    keywords: ["running", "sport", "fitness", "coach", "workout", "course", "marathon"],
    strongKeywords: ["fitness", "workout", "running", "coach", "training"],
    antiKeywords: SPORTS_MEDIA_ANTI_KEYWORDS,
    searchQueries: ["fitness workout app", "running tracker", "sport coach training"],
    priority: 1,
  },
];

function normalizeText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildConceptCorpus(
  concept: string,
  understanding: ApplabConceptUnderstanding,
): string {
  return normalizeText(
    [
      concept,
      understanding.niche,
      understanding.core_problem,
      understanding.main_use_case,
      understanding.specific_subject,
      ...understanding.key_features,
      ...understanding.must_match,
    ].join(" "),
  );
}

export type CompetitorSectorProfile = Readonly<{
  categories: readonly string[];
  keywords: readonly string[];
  excludeCategories?: readonly string[];
  antiKeywords?: readonly string[];
  requireStrongKeyword?: boolean;
  strongKeywords?: readonly string[];
  searchQueries?: readonly string[];
  notCompetitors?: readonly string[];
  mustMatch?: readonly string[];
}>;

export type CompetitorSearchHints = Readonly<{
  searchQueries: readonly string[];
  notCompetitors: readonly string[];
  mustMatch: readonly string[];
  sector: CompetitorSectorProfile;
}>;

export function conceptIsFitnessTracking(corpus: string): boolean {
  return FITNESS_TRACKING_PATTERN.test(corpus);
}

export function isSportsMediaApp(
  app: Pick<SearchResultWithTrackappMetrics, "name" | "description" | "category">,
): boolean {
  const hay = normalizeText(`${app.name} ${app.description ?? ""} ${app.category ?? ""}`);
  if (SPORTS_MEDIA_BRAND_PATTERN.test(app.name) || SPORTS_MEDIA_BRAND_PATTERN.test(hay)) {
    return true;
  }
  if (SPORTS_MEDIA_ANTI_KEYWORDS.some((k) => hay.includes(k))) return true;

  const cat = normalizeText(app.category ?? "");
  const inSportsCategory = cat.includes("sport") && !cat.includes("health") && !cat.includes("fitness");
  if (!inSportsCategory) return false;

  const hasFitnessSignal = FITNESS_STRONG_KEYWORDS.some((k) => hay.includes(k));
  return !hasFitnessSignal;
}

function collectMatchingRules(corpus: string): readonly SectorRule[] {
  let bestPriority = -1;
  const matched: SectorRule[] = [];

  for (const rule of SECTOR_RULES) {
    if (!rule.pattern.test(corpus)) continue;
    const priority = rule.priority ?? 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      matched.length = 0;
    }
    if (priority === bestPriority) matched.push(rule);
  }

  return matched;
}

function buildSectorProfileFromRules(corpus: string, rules: readonly SectorRule[]): CompetitorSectorProfile {
  const categories = new Set<string>();
  const keywords = new Set<string>();
  const excludeCategories = new Set<string>();
  const antiKeywords = new Set<string>();
  const strongKeywords = new Set<string>();
  const searchQueries = new Set<string>();
  const notCompetitors = new Set<string>();
  const mustMatch = new Set<string>();
  let requireStrongKeyword = false;

  for (const rule of rules) {
    for (const c of rule.categories) categories.add(c);
    for (const k of rule.keywords) keywords.add(k);
    for (const ex of rule.excludeCategories ?? []) excludeCategories.add(ex);
    for (const k of rule.antiKeywords ?? []) antiKeywords.add(k);
    for (const k of rule.strongKeywords ?? []) strongKeywords.add(k);
    for (const q of rule.searchQueries ?? []) searchQueries.add(q);
    for (const n of rule.notCompetitors ?? []) notCompetitors.add(n);
    for (const m of rule.mustMatch ?? []) mustMatch.add(m);
    if (rule.requireStrongKeyword) requireStrongKeyword = true;
  }

  for (const token of corpus.split(/\s+/).filter((t) => t.length >= 4)) {
    keywords.add(token);
  }

  const fitnessTracking = conceptIsFitnessTracking(corpus);
  if (fitnessTracking) {
    requireStrongKeyword = true;
    excludeCategories.add("Sports");
    for (const k of FITNESS_STRONG_KEYWORDS) strongKeywords.add(k);
    for (const k of SPORTS_MEDIA_ANTI_KEYWORDS) antiKeywords.add(k);
  }

  return {
    categories: categories.size > 0 ? [...categories] : [],
    keywords: [...keywords],
    excludeCategories: excludeCategories.size > 0 ? [...excludeCategories] : undefined,
    antiKeywords: antiKeywords.size > 0 ? [...antiKeywords] : undefined,
    requireStrongKeyword: requireStrongKeyword || undefined,
    strongKeywords: strongKeywords.size > 0 ? [...strongKeywords] : undefined,
    searchQueries: searchQueries.size > 0 ? [...searchQueries] : undefined,
    notCompetitors: notCompetitors.size > 0 ? [...notCompetitors] : undefined,
    mustMatch: mustMatch.size > 0 ? [...mustMatch] : undefined,
  };
}

export function inferCompetitorSector(
  concept: string,
  understanding: ApplabConceptUnderstanding,
): CompetitorSectorProfile {
  const corpus = buildConceptCorpus(concept, understanding);
  const rules = collectMatchingRules(corpus);
  if (rules.length === 0) {
    return { categories: [], keywords: [...corpus.split(/\s+/).filter((t) => t.length >= 4)] };
  }
  return buildSectorProfileFromRules(corpus, rules);
}

/** Indices de recherche concurrents à partir du concept brut (tous secteurs). */
export function buildCompetitorSearchHints(
  concept: string,
  extraCorpus = "",
): CompetitorSearchHints {
  const corpus = normalizeText(`${concept} ${extraCorpus}`.trim());
  const rules = collectMatchingRules(corpus);
  const sector =
    rules.length > 0
      ? buildSectorProfileFromRules(corpus, rules)
      : { categories: [], keywords: [...corpus.split(/\s+/).filter((t) => t.length >= 4)] };

  const searchQueries = [
    ...(sector.searchQueries ?? []),
    concept.slice(0, 48),
    ...corpus.split(/\s+/).filter((t) => t.length >= 5).slice(0, 4),
  ]
    .map((q) => q.trim())
    .filter((q) => q.length >= 4)
    .filter((q, i, arr) => arr.indexOf(q) === i)
    .slice(0, 8);

  return {
    searchQueries,
    notCompetitors: sector.notCompetitors ?? [],
    mustMatch: sector.mustMatch ?? [],
    sector,
  };
}

export function categoryMatchesSector(category: string, sector: CompetitorSectorProfile): boolean {
  const cat = normalizeText(category);
  if (sector.excludeCategories?.some((ex) => cat.includes(normalizeText(ex)))) return false;
  if (sector.categories.length === 0) return true;
  return sector.categories.some((c) => cat.includes(normalizeText(c)) || normalizeText(c).includes(cat));
}

export function isOffTopicApp(
  app: Pick<SearchResultWithTrackappMetrics, "name" | "description" | "category">,
  sector: CompetitorSectorProfile,
): boolean {
  if (isSportsMediaApp(app)) return true;
  const hay = normalizeText(`${app.name} ${app.description ?? ""} ${app.category ?? ""}`);
  return (sector.antiKeywords ?? []).some((k) => k.length >= 4 && hay.includes(normalizeText(k)));
}

export function appMatchesSectorKeywords(
  app: Pick<SearchResultWithTrackappMetrics, "name" | "description" | "category">,
  sector: CompetitorSectorProfile,
): boolean {
  if (isOffTopicApp(app, sector)) return false;

  const hay = normalizeText(`${app.name} ${app.description ?? ""} ${app.category ?? ""}`);

  if (sector.requireStrongKeyword && sector.strongKeywords?.length) {
    return sector.strongKeywords.some((k) => k.length >= 4 && hay.includes(k));
  }

  if (sector.keywords.length === 0) return true;
  return sector.keywords.some((k) => k.length >= 4 && hay.includes(k));
}

export function appPassesSectorGate(
  app: Pick<SearchResultWithTrackappMetrics, "name" | "description" | "category">,
  sector: CompetitorSectorProfile,
): boolean {
  return (
    !isOffTopicApp(app, sector) &&
    categoryMatchesSector(app.category ?? "", sector) &&
    appMatchesSectorKeywords(app, sector)
  );
}

export function isProjectBrandHomonym(
  app: Pick<SearchResultWithTrackappMetrics, "name" | "category">,
  projectName: string,
  concept: string,
  understanding: ApplabConceptUnderstanding,
  sector: CompetitorSectorProfile,
): boolean {
  const brand = normalizeText(projectName.split(/[:–\-|]/)[0] ?? projectName);
  if (brand.length < 3) return false;

  const appBrand = normalizeText(app.name.split(/[:–\-|]/)[0] ?? app.name);
  const nameCollision =
    appBrand === brand || appBrand.startsWith(`${brand} `) || appBrand.startsWith(brand);

  if (!nameCollision) return false;

  const corpus = buildConceptCorpus(concept, understanding);
  const appHay = normalizeText(app.name);
  const conceptTokens = corpus.split(/\s+/).filter((t) => t.length >= 4);
  const conceptOverlap = conceptTokens.filter((t) => appHay.includes(t)).length;

  if (conceptOverlap >= 2) return false;

  if (sector.categories.length > 0) {
    return !categoryMatchesSector(app.category ?? "", sector);
  }

  return conceptOverlap === 0;
}

/** Le nom de projet seul ne doit pas être une requête App Store (faux positifs homonymes). */
export function sanitizeCompetitorSearchQueries(
  queries: readonly string[],
  projectName: string,
  concept: string,
): string[] {
  const brand = normalizeText(projectName);
  const conceptNorm = normalizeText(concept);

  return [...new Set(queries.map((q) => q.trim()).filter(Boolean))].filter((q) => {
    const n = normalizeText(q);
    if (n.length < 3) return false;
    if (brand.length >= 3 && n === brand) return false;
    if (brand.length >= 3 && n.split(/\s+/).length === 1 && n === brand) return false;
    if (conceptNorm.includes(n) || n.includes(conceptNorm.slice(0, Math.min(conceptNorm.length, 24)))) {
      return true;
    }
    return n.split(/\s+/).length >= 2 || n.length >= 5;
  });
}

export function revenueSortKey(sortRevenueUsd: number, revenueDisplay: string): number {
  if (sortRevenueUsd > 50) return sortRevenueUsd;
  if (revenueDisplay.trim() === "<100€") return 50;
  return 0;
}
