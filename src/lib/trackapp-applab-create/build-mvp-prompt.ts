import {
  CLAUDE_Q_PARAM_MAX,
  CURSOR_PROMPT_PARAM_MAX,
  buildClaudeCodeDeeplink,
  buildCursorPromptDeeplink,
  truncatePromptForDeeplink,
} from "@/lib/trackapp-clone-prompt/deeplinks";
import { scoreApplabPromptQuality } from "@/lib/trackapp-applab-create/prompt-quality-score";
import {
  APPLAB_TECH_STACK_ONE_LINER,
  buildFixedTechStackCodingRules,
  buildFixedTechStackSection,
} from "@/lib/trackapp-applab-create/fixed-tech-stack";
import {
  buildClientFunnelUxSection,
  buildTrackappResourcesPromptSection,
} from "@/lib/trackapp-ressources/build-prompt-section";
import { catalogEntryById } from "@/lib/trackapp-ressources/catalog";
import type {
  ApplabMvpPromptBlueprint,
  ApplabMvpPromptBundle,
  ApplabMvpPromptInput,
  ApplabMvpStack,
  ApplabPromptFiles,
  ApplabPromptVersion,
  ApplabReferenceContext,
} from "@/lib/trackapp-applab-create/mvp-prompt-types";

function stackLabel(stack: ApplabMvpStack): string {
  switch (stack) {
    case "swiftui":
      return "SwiftUI + Xcode · RevenueCat · Firebase";
    case "expo":
      return "Expo SDK 52+ (React Native) — EAS Build, OTA updates";
    case "react-native":
      return "React Native bare — contrôle modules natifs maximal";
    case "flutter":
      return "Flutter 3.x — iOS + Android, Material/Cupertino, Dart";
  }
}

function stackInitInstructions(stack: ApplabMvpStack): string {
  switch (stack) {
    case "swiftui":
      return [
        "- Xcode 16+, Swift 5.10+, SwiftUI + Observation (`@Observable`).",
        "- Structure : `App/`, `Features/`, `Core/`, `DesignSystem/`, `Services/Firebase/`, `Services/RevenueCat/`.",
        "- SPM Firebase : Auth, Firestore, Analytics, Crashlytics (+ Storage si médias).",
        "- SPM RevenueCat (`Purchases`) — seul gestionnaire IAP.",
        "- Sign in with Apple via Firebase Auth.",
        "- `GoogleService-Info.plist` + xcconfig Debug/Release.",
      ].join("\n");
    case "expo":
      return [
        "- `npx create-expo-app@latest` TypeScript, Expo Router.",
        "- `app/`, `components/`, `hooks/`, `services/`, `constants/`.",
        "- `expo-router`, `react-native-purchases`, AsyncStorage.",
        "- EAS Build TestFlight ; `app.json` + `eas.json`.",
      ].join("\n");
    case "react-native":
      return [
        "- React Native CLI + TypeScript, React Navigation 7.",
        "- `react-native-purchases`, AsyncStorage.",
        "- `src/screens`, `src/components`, `src/navigation`, `src/services`.",
      ].join("\n");
    case "flutter":
      return [
        "- Flutter 3.x stable, Dart 3, `flutter create --org com.yourcompany`.",
        "- Structure : `lib/features/`, `lib/core/`, `lib/shared/`, `lib/main.dart`.",
        "- Packages : `purchases_flutter` (RevenueCat), `go_router`, `flutter_riverpod`.",
        "- iOS : Xcode workspace ; Android optionnel pour MVP iOS-first.",
      ].join("\n");
  }
}

function stackPaymentInstructions(stack: ApplabMvpStack): string {
  const common = [
    "- **RevenueCat** pour abonnements (entitlements, restore, analytics IAP).",
    "- Créer product IDs App Store Connect AVANT le paywall.",
    "- Essai gratuit 3–7 j si abo ; Restore ; CGU + Privacy Policy.",
    "- Pas de lien paiement externe (Guideline 3.1.1).",
  ];
  if (stack === "swiftui") {
    return [...common, "- StoreKit 2 via RevenueCat Swift ; UI achat `@MainActor`."].join("\n");
  }
  if (stack === "flutter") {
    return [...common, "- `purchases_flutter` ; config iOS StoreKit via RevenueCat dashboard."].join("\n");
  }
  return [...common, "- `react-native-purchases` ou RevenueCat Expo plugin."].join("\n");
}

function slugifyFilename(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "app"
  );
}

function bulletList(items: readonly string[], fallback = "—"): string {
  if (items.length === 0) return fallback;
  return items.map((x) => `- ${x}`).join("\n");
}

function uniqueStrings(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function formatScreens(blueprint: ApplabMvpPromptBlueprint): string {
  return blueprint.screens
    .map(
      (s, i) =>
        `### ${i + 1}. ${s.title} (\`${s.id}\`)\n**Rôle :** ${s.purpose}\n**Composants :** ${s.key_components.join(", ") || "—"}`,
    )
    .join("\n\n");
}

function formatOnboarding(blueprint: ApplabMvpPromptBlueprint): string {
  if (blueprint.onboarding_steps.length === 0) return "—";
  return blueprint.onboarding_steps
    .map((s) => `${s.step}. **${s.headline}** (\`${s.screen_id}\`)\n   ${s.body}`)
    .join("\n\n");
}

function formatDataModels(blueprint: ApplabMvpPromptBlueprint): string {
  return blueprint.data_models
    .map((m) => `### ${m.name}\n- Champs : ${m.fields.join(", ") || "—"}\n- Notes : ${m.notes}`)
    .join("\n\n");
}

function formatIapProducts(blueprint: ApplabMvpPromptBlueprint): string {
  return blueprint.iap_products
    .map((p) => `- \`${p.product_id}\` (${p.type}) — **${p.label}** : ${p.description}`)
    .join("\n");
}

function formatReferenceBlock(ref: ApplabReferenceContext): string {
  const shots =
    ref.screenshotUrls.length > 0 ?
      ref.screenshotUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")
    : "—";

  return [
    "## Référence concurrente (inspiration UX — ne pas copier)",
    `- **Nom (référence) :** ${ref.name}`,
    `- **Éditeur :** ${ref.artistName}`,
    `- **Catégorie :** ${ref.category}`,
    `- **Note :** ${ref.averageRating}`,
    `- **Téléchargements / mois :** ${ref.downloadsDisplay}`,
    `- **Revenus / mois :** ${ref.revenueDisplay}`,
    `- **App Store :** ${ref.trackViewUrl}`,
    "",
    "### Description (analyse promesse produit)",
    ref.description || "(indisponible — déduire depuis screenshots)",
    ref.releaseNotes ? `\n### Release notes récentes\n${ref.releaseNotes}` : "",
    "",
    "### Screenshots (analyse onboarding / paywall / navigation)",
    shots,
    "",
    "**Interdit :** réutiliser nom, logo, copy, assets ou charte de cette app.",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatConstraintsBlock(input: ApplabMvpPromptInput): string | null {
  const must = input.constraints.mustHave.trim();
  const mustNot = input.constraints.mustNot.trim();
  if (!must && !mustNot) return null;
  return [
    "## Contraintes utilisateur (prioritaires)",
    must ? `### Must-have\n${must}` : null,
    mustNot ? `### Must-not\n${mustNot}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const STATIC_NEGATIVE = [
  "Ne copie jamais nom, logo, charte ou assets d'une app existante.",
  "Pas de fausses reviews ou métriques inventées dans l'UI.",
  "Pas de secrets hardcodés — xcconfig / env Release.",
  "Pas de paywall avant démo de valeur (Guideline 3.1.1).",
  "Pas de placeholder, Lorem ipsum, TODO visible, écran « coming soon » en v1.0.",
  "Pas de livrable « MVP TestFlight only » — viser soumission App Store.",
] as const;

const STATIC_RULES = [
  "Code/identifiants en anglais ; copy UI en français (ou langue cible).",
  "Typage strict ; composants < 200 lignes ; architecture testable.",
  "États loading / empty / error / offline / success sur chaque écran data-driven.",
  "Accessibilité : VoiceOver, contrastes WCAG AA, Dynamic Type, touch 44pt.",
  "Analytics snake_case → Firebase Analytics (`Analytics.logEvent`).",
  "Crash reporting → Firebase Crashlytics uniquement.",
  "Settings : CGU, Privacy, support, restore achats ; suppression compte si auth.",
  "Build Release sans logs debug ; README + variables documentées.",
] as const;

const STATIC_APPLE = [
  "Privacy Nutrition Labels à jour avant soumission.",
  "Privacy Policy + Terms live si abonnement auto-renouvelable.",
  "Sign in with Apple si login social tiers.",
  "App Review : compte démo + notes review si auth ou IAP.",
  "Guideline 4.2 : valeur native, pas webview seule.",
  "Export compliance, classification d'âge, Support URL obligatoire.",
  "IAP testés sandbox ; restore ; pas de lien paiement externe.",
] as const;

const DEFAULT_EXECUTION_PHASES = [
  "Phase A — Valider spec v1.0 App Store (sections ci-dessous)",
  "Phase B — Télécharger ZIP Trackapp (script curl Ressources)",
  "Phase C — Projet Xcode + Firebase (GoogleService-Info.plist, SPM Firebase + RevenueCat)",
  "Phase D — Firestore collections + Auth Apple + règles sécurité",
  "Phase E — Funnel welcome → onboarding → paywall → winback → home",
  "Phase F — Features métier + sync Firestore (cache local offline)",
  "Phase G — RevenueCat IAP + restore + pages légales",
  "Phase H — Settings, Crashlytics, Analytics, erreurs/offline",
  "Phase I — Assets App Store + sandbox IAP + soumission Review",
] as const;

type BuildCtx = Readonly<{
  input: ApplabMvpPromptInput;
  blueprint: ApplabMvpPromptBlueprint;
  negatives: readonly string[];
  rules: readonly string[];
  apple: readonly string[];
}>;

function buildContext(input: ApplabMvpPromptInput, blueprint: ApplabMvpPromptBlueprint): BuildCtx {
  const fixedRules = buildFixedTechStackCodingRules();
  return {
    input,
    blueprint,
    negatives: uniqueStrings([...STATIC_NEGATIVE, ...blueprint.negative_prompts]),
    rules: uniqueStrings([...STATIC_RULES, ...fixedRules, ...blueprint.coding_rules]),
    apple: uniqueStrings([...STATIC_APPLE, ...blueprint.apple_compliance]),
  };
}

export function buildProductSpecMd(ctx: BuildCtx): string {
  const { input, blueprint } = ctx;
  const { understanding, assessment, concept, projectName } = input;

  return [
    `# PRODUCT_SPEC — ${blueprint.app_working_name}`,
    "",
    "## One-liner",
    blueprint.one_liner,
    "",
    "## Proposition de valeur",
    blueprint.value_proposition,
    "",
    "## Persona & cible",
    `- **Cible :** ${assessment.target_user || understanding.target_user}`,
    `- **Problème :** ${understanding.core_problem}`,
    `- **Use case :** ${understanding.main_use_case}`,
    `- **Niche :** ${understanding.niche}`,
    `- **Proposition de valeur :** ${assessment.value_proposition || assessment.headline}`,
    `- **Positionnement :** ${assessment.positioning || assessment.differentiation}`,
    "",
    "### Insight marché",
    assessment.market_insight || assessment.summary,
    "",
    ...(assessment.client_personas?.length
      ? [
          "### Avatars clients",
          ...assessment.client_personas.flatMap((p) => [
            `#### ${p.name} — ${p.label} (${p.age_range})`,
            p.profile,
            `- Objectifs: ${p.goals}`,
            `- Frustrations: ${p.frustrations}`,
            `- Pourquoi cette app: ${p.why_this_app}`,
            "",
          ]),
        ]
      : []),
    "",
    "## Concept",
    concept,
    "",
    "## Synthèse AppLAB",
    assessment.summary,
    "",
    "### Comment ça marche",
    assessment.how_it_works,
    "",
    "### Différenciation",
    assessment.differentiation,
    "",
    "## Périmètre v1.0 App Store",
    bulletList(assessment.mvp_features),
    "",
    "## Hors-scope (post-lancement)",
    "- Features non listées ci-dessus",
    "- Refactors majeurs ou v2 multi-plateforme",
    "",
    "## Monétisation",
    `- Modèle : ${blueprint.iap_model}`,
    `- Assessment : ${assessment.monetization}`,
    `- Paywall : ${blueprint.paywall_trigger}`,
    "",
    "## Risques",
    bulletList(assessment.risks),
    "",
    formatConstraintsBlock(input) ?? "",
    "",
    `— ${projectName} · AppLAB Trackapp`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function buildUxFlowsMd(ctx: BuildCtx): string {
  const { blueprint } = ctx;
  return [
    `# UX_FLOWS — ${blueprint.app_working_name}`,
    "",
    buildClientFunnelUxSection(),
    "",
    "## Écrans produit v1.0 (funnel + métier)",
    formatScreens(blueprint),
    "",
    "## Onboarding first-run",
    formatOnboarding(blueprint),
    "",
    "## Écran winback_game (rejet paywall)",
    "- Déclencheur : `paywall_dismiss` ou `purchase_cancelled` sans achat.",
    "- UX : animation/jeu 5–15 s → révéler offre remise (badge « -40% » ou essai +7 j).",
    "- CTA : « Profiter de l'offre » → paywall secondaire avec product_id promo si configuré.",
    "- Skip discret → home en mode freemium limité (pas de blocage total).",
    "",
    "## Règles UX production",
    "- Max 4–5 écrans onboarding avant paywall.",
    "- Permissions (notifs, ATT) après démo de valeur.",
    "- États vides avec CTA clair ; erreurs réseau avec retry ; mode offline explicite.",
    "- Écran Settings : légal, support, restore, préférences.",
    "",
    "## Navigation post-achat",
    "- Tab bar depuis ressource Trackapp (section Ressources).",
    "- Paywall modal ou fullScreenCover (`paywall`, `winback_game`).",
  ].join("\n");
}

export function buildResourcesMd(ctx: BuildCtx): string {
  const { input, blueprint } = ctx;
  const fromBlueprint = blueprint.trackapp_resource_ids
    .map((id) => catalogEntryById(id))
    .filter((e): e is NonNullable<typeof e> => e != null);

  const resources =
    input.trackappResources && input.trackappResources.length > 0 ?
      input.trackappResources
    : fromBlueprint.length > 0 ?
      fromBlueprint
    : undefined;

  return buildTrackappResourcesPromptSection({
    concept: input.concept,
    niche: input.understanding.niche,
    mvpFeatures: input.assessment.mvp_features,
    resources,
    appName: blueprint.app_working_name,
  });
}

export function buildArchitectureMd(ctx: BuildCtx): string {
  const { input, blueprint, rules } = ctx;
  return [
    `# ARCHITECTURE — ${blueprint.app_working_name}`,
    "",
    "## Stack",
    stackLabel(input.stack),
    "",
    stackInitInstructions(input.stack),
    "",
    buildFixedTechStackSection(blueprint),
    "",
    "## Structure projet",
    "```",
    blueprint.folder_structure.join("\n"),
    "```",
    "",
    "## Modèles de données",
    formatDataModels(blueprint),
    "",
    "## Monétisation (IAP)",
    `- Modèle : ${blueprint.iap_model}`,
    `- Trigger : ${blueprint.paywall_trigger}`,
    "",
    formatIapProducts(blueprint),
    "",
    stackPaymentInstructions(input.stack),
    "",
    "## Analytics & observabilité",
    bulletList(blueprint.analytics_events),
    "",
    "## Production & release",
    "- Configurations Debug vs Release (xcconfig, pas de clés en dur).",
    "- Firebase Crashlytics activé ; test crash symbolication.",
    "- Keychain pour tokens ; sync Firestore ↔ cache local.",
    "- Versioning sémantique 1.0.0 ; build number incrémenté.",
    "",
    "## Règles de code",
    bulletList(rules),
    "",
    "## Negative prompts",
    bulletList(ctx.negatives),
  ].join("\n");
}

export function buildAppStoreMd(ctx: BuildCtx): string {
  const { blueprint, apple, input } = ctx;
  return [
    `# APP_STORE — ${blueprint.app_working_name}`,
    "",
    "## Métadonnées (brouillon)",
    `- Nom de travail : ${blueprint.app_working_name}`,
    `- Sous-titre : (≤ 30 car.) — dériver de : ${blueprint.one_liner}`,
    `- Keywords FR/EN : niche + use case + cible`,
    "",
    "## Conformité Apple",
    bulletList(apple),
    "",
    "## Accessibilité",
    bulletList(
      blueprint.accessibility.length > 0 ? blueprint.accessibility : [
        "VoiceOver labels",
        "Dynamic Type",
        "Contrastes WCAG AA",
        "Touch targets 44pt",
      ],
    ),
    "",
    "## Checklist soumission App Store",
    "- [ ] Icône 1024×1024 + assets App Icon set",
    "- [ ] Screenshots 6.7\" et 6.5\" (FR) — onboarding, core, paywall flouté si besoin",
    "- [ ] Nom, sous-titre (≤30), description, keywords, catégorie",
    "- [ ] Privacy Policy URL live + Terms si abo",
    "- [ ] Privacy Nutrition Labels complétés dans App Store Connect",
    "- [ ] Support URL + contact utilisateur",
    "- [ ] Compte démo + notes App Review (auth/IAP)",
    "- [ ] IAP sandbox validés + Restore Purchases",
    "- [ ] Build Release : zéro placeholder, zéro crash au lancement",
    "- [ ] Export compliance + classification d'âge",
    "- [ ] Soumettre pour Review (pas s'arrêter à TestFlight interne)",
    "",
    "## Produits IAP",
    formatIapProducts(blueprint),
    "",
    input.reference ?
      `## Référence marché\nInspiré des patterns de **${input.reference.name}** — design original obligatoire.`
    : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildMasterPromptMd(ctx: BuildCtx): string {
  const { input, blueprint } = ctx;
  const { projectName, understanding, assessment, clarifications } = input;
  const hasClarifications = clarifications.trim().length > 0;

  return [
    "# PROMPT APP STORE COMPLET — SwiftUI + Xcode",
    "",
    "Tu es **lead product engineer iOS** (product + UX + architecture + implémentation + release).",
    `Livrer une **app v1.0 production-ready**, soumissible à **App Store Review**, pour **${blueprint.app_working_name}**.`,
    "",
    "Ce prompt contient la spec complète en sections : PRODUCT_SPEC, UX_FLOWS, RESOURCES, ARCHITECTURE, APP_STORE.",
    "Objectif final : **accueillir de vrais utilisateurs** — pas un prototype ni un MVP jetable.",
    "",
    "## Règles non négociables (résumé)",
    "- SwiftUI + Firebase + RevenueCat — stack imposée (détail dans ARCHITECTURE).",
    "- Funnel welcome → onboarding → paywall → winback → home (détail dans UX_FLOWS).",
    "- Zéro placeholder UI en release ; états loading/empty/error partout.",
    "- Règles complètes, negative prompts et conformité Apple : voir sections ARCHITECTURE et APP_STORE.",
    "",
    formatConstraintsBlock(input) ?? null,
    "",
    input.reference ? formatReferenceBlock(input.reference) : null,
    "",
    "## Contexte projet",
    `- Projet : ${projectName}`,
    `- One-liner : ${blueprint.one_liner}`,
    "",
    hasClarifications ? clarifications.trim() : `—\n${input.concept.trim()}`,
    "",
    `- Cible : ${understanding.target_user}`,
    `- Niche : ${understanding.niche}`,
    `- Fonctionnalités v1.0 : ${uniqueStrings(assessment.mvp_features).join(" · ")}`,
    "",
    "## Stack (imposée — aucun choix utilisateur)",
    APPLAB_TECH_STACK_ONE_LINER,
    "",
    "## Plan d'exécution (A → Z App Store)",
    bulletList(
      blueprint.execution_phases.length > 0 ? blueprint.execution_phases : [...DEFAULT_EXECUTION_PHASES],
    ),
    "",
    "## Première action",
    "1. Lis **tout** ce prompt.",
    "2. Exécute le script curl (section Ressources Trackapp).",
    "3. Pose max 3 questions si ambiguïté, puis implémente jusqu'à une build **Release** soumissible.",
    "Français pour le dialogue ; anglais pour le code.",
    "",
    `— AppLAB Trackapp · ${projectName}`,
  ]
    .filter((line): line is string => line != null && line !== "")
    .join("\n");
}

export function buildApplabMvpPromptFiles(
  input: ApplabMvpPromptInput,
  blueprint: ApplabMvpPromptBlueprint,
): ApplabPromptFiles {
  const ctx = buildContext(input, blueprint);
  return {
    MASTER: buildMasterPromptMd(ctx),
    PRODUCT_SPEC: buildProductSpecMd(ctx),
    UX_FLOWS: buildUxFlowsMd(ctx),
    ARCHITECTURE: buildArchitectureMd(ctx),
    APP_STORE: buildAppStoreMd(ctx),
    RESOURCES: buildResourcesMd(ctx),
  };
}

export function buildApplabMvpFullPrompt(files: ApplabPromptFiles): string {
  return [
    files.MASTER,
    "",
    "---",
    "",
    files.PRODUCT_SPEC,
    "",
    "---",
    "",
    files.UX_FLOWS,
    "",
    "---",
    "",
    files.RESOURCES,
    "",
    "---",
    "",
    files.ARCHITECTURE,
    "",
    "---",
    "",
    files.APP_STORE,
  ].join("\n");
}

export function buildApplabMvpDeeplinkPrompt(fullPrompt: string): string {
  const suffix = `[…] Prompt complet AppLAB (${fullPrompt.length} car.) — utilise Copier pour la version intégrale.`;
  return truncatePromptForDeeplink(
    fullPrompt,
    Math.min(CURSOR_PROMPT_PARAM_MAX, CLAUDE_Q_PARAM_MAX) - 20,
    suffix,
  );
}

export function assembleApplabMvpPromptBundle(
  input: ApplabMvpPromptInput,
  blueprint: ApplabMvpPromptBlueprint,
  versionNumber: number,
  versionId: string,
): ApplabMvpPromptBundle {
  const files = buildApplabMvpPromptFiles(input, blueprint);
  const fullPrompt = buildApplabMvpFullPrompt(files);
  const deeplinkPrompt = buildApplabMvpDeeplinkPrompt(fullPrompt);
  const slug = slugifyFilename(input.projectName);

  const hasReference = Boolean(input.reference);
  const hasConstraints = Boolean(
    input.constraints.mustHave.trim() || input.constraints.mustNot.trim(),
  );
  const hasResources = Boolean(
    input.trackappResources && input.trackappResources.length > 0,
  );
  const quality = scoreApplabPromptQuality(
    blueprint,
    hasReference,
    hasConstraints,
    hasResources,
  );
  const generatedAt = new Date().toISOString();

  const promptVersion: ApplabPromptVersion = {
    id: versionId,
    version: versionNumber,
    stack: input.stack,
    generatedAt,
    files,
    fullPrompt,
    blueprint,
    quality,
  };

  return {
    projectName: input.projectName,
    stack: input.stack,
    files,
    fullPrompt,
    deeplinkPrompt,
    markdownFilename: `applab-mvp-${slug}-v${versionNumber}.md`,
    zipBasename: `applab-mvp-${slug}`,
    cursorDeeplink: buildCursorPromptDeeplink(deeplinkPrompt, false),
    cursorWebDeeplink: buildCursorPromptDeeplink(deeplinkPrompt, true),
    claudeDeeplink: buildClaudeCodeDeeplink(
      truncatePromptForDeeplink(deeplinkPrompt, CLAUDE_Q_PARAM_MAX, "Export AppLAB .md"),
    ),
    blueprint,
    quality,
    promptVersion,
    generatedAt,
  };
}
