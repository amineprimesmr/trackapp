import { assembleApplabMvpPromptBundle } from "@/lib/trackapp-applab-create/build-mvp-prompt";
import { loadApplabReferenceContext } from "@/lib/trackapp-applab-create/load-reference-context";
import { APPLAB_MVP_PROMPT_JSON_SCHEMA } from "@/lib/trackapp-applab-create/mvp-prompt-schema";
import type {
  ApplabCreateConstraints,
  ApplabMvpPromptBundle,
  ApplabMvpStack,
} from "@/lib/trackapp-applab-create/mvp-prompt-types";
import { parseApplabMvpPromptBlueprint } from "@/lib/trackapp-applab-create/parse-mvp-prompt-blueprint";
import { formatClarifyAnswersBlock } from "@/lib/trackapp-applab-project/analyze-concept";
import { callApplabProjectOpenAi } from "@/lib/trackapp-applab-project/openai";
import type {
  ApplabConceptAnswers,
  ApplabConceptAssessment,
  ApplabConceptUnderstanding,
  ApplabClarifyingQuestion,
} from "@/lib/trackapp-applab-project/types";
import type { CountryCode } from "@/lib/apple-charts";
import { TRACKAPP_RESOURCE_CATALOG } from "@/lib/trackapp-ressources/catalog";
import { matchTrackappResourcesForPrompt } from "@/lib/trackapp-ressources/match-for-prompt";

const BUILD_MVP_PROMPT_SYSTEM = `Tu es l'architecte prompt AppLAB de Trackapp. Tu génères un blueprint JSON pour qu'un IDE IA construise une **app iOS v1.0 prête App Store** — pas un prototype, pas un MVP TestFlight, pas une démo.

OBJECTIF: application **production-ready**, soumissible à App Review, capable d'accueillir de vrais utilisateurs dès le lancement.

Stack **imposée** (aucun choix utilisateur) :
- **Client** : SwiftUI + Xcode (@Observable)
- **IAP** : RevenueCat (Purchases iOS SDK)
- **Backend** : Firebase — Auth, Cloud Firestore, Analytics, Crashlytics, Storage si médias
- **Auth** : Sign in with Apple via Firebase Auth ; uid = RevenueCat appUserID
- **Interdit** : Supabase, serveur custom, REST maison, Sentry, StoreKit sans RevenueCat

data_models[] = collections **Firestore** (name = collection, fields = champs document, notes = règles/index).
folder_structure DOIT inclure : Services/Firebase/, Services/RevenueCat/, GoogleService-Info.plist.
coding_rules DOIT mentionner Firebase + RevenueCat.

FUNNEL CLIENT OBLIGATOIRE (screens[]):
1. welcome — splash / promesse / CTA Commencer
2. onboarding — 3-5 étapes (démo valeur, permissions après)
3. paywall — RevenueCat, essai, restore, legal
4. winback_game — rejet paywall → jeu/animation → offre remise
5. home — app principale (tab bar + features métier complètes)

screens[] DOIT inclure AU MINIMUM: welcome, onboarding_*, paywall, winback_game, home + **tous** les écrans métier v1.0 (settings, profil, erreurs, etc.) — **8 à 14 écrans**, chacun fini (pas de placeholder).

trackapp_resource_ids: 4-10 ids catalogue Trackapp (ZIP SwiftUI) — funnel + UI core.

PRODUCTION OBLIGATOIRE (à refléter dans screens, coding_rules, apple_compliance, execution_phases):
- Zéro UI placeholder / Lorem / TODO visible en release
- États loading, empty, error, offline sur chaque flux data
- Settings: CGU, Privacy, contact/support, restore achats, suppression compte si auth
- IAP RevenueCat testés sandbox + restore
- Analytics funnel → Firebase Analytics ; crash reporting → Firebase Crashlytics uniquement
- Accessibilité VoiceOver, Dynamic Type, contrastes
- Métadonnées App Store + checklist soumission Review
- Icône, screenshots, Privacy Nutrition Labels

execution_phases: plan A→Z jusqu'à **soumission App Store** (pas s'arrêter à TestFlight).

Règles JSON:
- Français sauf product_id, screen_id, code.
- iap_products: pas de montants €/$.
- Contraintes utilisateur prioritaires si fournies.
- Référence concurrente: patterns UX only.

Réponds UNIQUEMENT en JSON conforme au schéma.`;

function stackHint(stack: ApplabMvpStack): string {
  switch (stack) {
    case "swiftui":
      return "SwiftUI + Xcode, SPM, @Observable";
    case "expo":
      return "Expo SDK 52+, Expo Router, TypeScript";
    case "react-native":
      return "React Native CLI, TypeScript, React Navigation 7";
    case "flutter":
      return "Flutter 3.x, Dart 3, Riverpod, go_router, purchases_flutter";
  }
}

export async function generateApplabMvpPrompt(input: {
  projectName: string;
  concept: string;
  stack: ApplabMvpStack;
  understanding: ApplabConceptUnderstanding;
  assessment: ApplabConceptAssessment;
  answers?: ApplabConceptAnswers;
  questions?: readonly ApplabClarifyingQuestion[];
  constraints?: ApplabCreateConstraints;
  referenceAppId?: string | null;
  referenceCountry?: CountryCode;
  versionNumber: number;
  versionId: string;
}): Promise<
  Readonly<{
    bundle: ApplabMvpPromptBundle | null;
    failure?: string;
    failureDetail?: string;
  }>
> {
  const clarifications = formatClarifyAnswersBlock(input.answers ?? {}, input.questions ?? []);
  const constraints = input.constraints ?? { mustHave: "", mustNot: "" };

  const matchedResources = matchTrackappResourcesForPrompt({
    concept: input.concept,
    niche: input.understanding.niche,
    mvpFeatures: input.assessment.mvp_features,
  });

  const reference =
    input.referenceAppId ?
      await loadApplabReferenceContext(input.referenceAppId, input.referenceCountry ?? "fr")
    : null;

  const catalogForAi = TRACKAPP_RESOURCE_CATALOG.map((r) => ({
    id: r.id,
    title: r.title,
    funnel: r.funnelStages,
    tags: r.tags,
    description: r.description,
  }));

  const userInput = JSON.stringify(
    {
      project_name: input.projectName.trim(),
      concept_raw: input.concept.trim(),
      stack: input.stack,
      stack_hint: stackHint(input.stack),
      understanding: input.understanding,
      assessment: input.assessment,
      clarifications,
      constraints: {
        must_have: constraints.mustHave.trim() || null,
        must_not: constraints.mustNot.trim() || null,
      },
      reference_app: reference ?
        {
          name: reference.name,
          category: reference.category,
          description_excerpt: reference.description.slice(0, 800),
        }
      : null,
      trackapp_resource_catalog: catalogForAi,
      suggested_resource_ids: matchedResources.map((r) => r.id),
    },
    null,
    2,
  );

  const result = await callApplabProjectOpenAi<unknown>({
    instructions: BUILD_MVP_PROMPT_SYSTEM,
    input: userInput,
    schemaName: "applab_mvp_prompt_blueprint",
    schema: APPLAB_MVP_PROMPT_JSON_SCHEMA as unknown as Record<string, unknown>,
    timeoutMs: 90_000,
  });

  if (!result.data) {
    return { bundle: null, failure: result.failure, failureDetail: result.failureDetail };
  }

  const blueprint = parseApplabMvpPromptBlueprint(result.data);
  if (!blueprint) {
    return { bundle: null, failure: "parse", failureDetail: "Blueprint prompt invalide" };
  }

  return {
    bundle: assembleApplabMvpPromptBundle(
      {
        projectName: input.projectName.trim(),
        concept: input.concept.trim(),
        stack: input.stack,
        understanding: input.understanding,
        assessment: input.assessment,
        clarifications,
        constraints,
        reference,
        trackappResources: matchedResources,
      },
      blueprint,
      input.versionNumber,
      input.versionId,
    ),
  };
}
