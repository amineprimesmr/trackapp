import {
  CLIENT_FUNNEL_NAV_RULES,
  TRACKAPP_CLIENT_FUNNEL_STAGES,
} from "@/lib/trackapp-ressources/client-funnel";
import type { TrackappResourceCatalogEntry } from "@/lib/trackapp-ressources/catalog";
import {
  matchTrackappResourcesForPrompt,
  resourceZipFilename,
} from "@/lib/trackapp-ressources/match-for-prompt";
import {
  promptExportSiteOrigin,
  resourcesManifestPublicUrl,
  resourceVideoPublicUrl,
  resourceZipPublicUrl,
} from "@/lib/trackapp-ressources/public-urls";

function bulletList(items: readonly string[]): string {
  return items.map((x) => `- ${x}`).join("\n");
}

export function buildTrackappResourcesPromptSection(input: {
  concept: string;
  niche?: string;
  mvpFeatures?: readonly string[];
  resources?: readonly TrackappResourceCatalogEntry[];
  siteOrigin?: string;
  appName?: string;
}): string {
  const resources =
    input.resources ??
    matchTrackappResourcesForPrompt({
      concept: input.concept,
      niche: input.niche,
      mvpFeatures: input.mvpFeatures,
    });

  const origin = input.siteOrigin ?? promptExportSiteOrigin();
  const appName = input.appName ?? "App";
  const manifestUrl = resourcesManifestPublicUrl(origin);

  const resourceBlocks = resources
    .map((r) => {
      const zip = resourceZipFilename(r);
      const zipUrl = resourceZipPublicUrl(r, origin);
      const videoUrl = resourceVideoPublicUrl(r, origin);
      const destDir = `ThirdPartyUI/Trackapp/${r.id}/`;
      return [
        `### ${r.title} (\`${r.id}\`)`,
        `- **ZIP :** \`${zip}\``,
        `- **URL publique (sans auth) :** ${zipUrl}`,
        `- **Vidéo démo :** ${videoUrl}`,
        `- **Funnel :** ${r.funnelStages.join(", ")}`,
        `- **Usage :** ${r.description}`,
        `- **Télécharger :**`,
        "  ```bash",
        `  mkdir -p ${destDir}`,
        `  curl -L -o "${destDir}${zip}" "${zipUrl}"`,
        `  unzip -o "${destDir}${zip}" -d "${destDir}"`,
        "  ```",
        "- **Intégration :** lire les fichiers .swift dézippés → copier/adaptation dans le projet (renommer types, tokens couleurs, copy FR) — ne pas modifier les sources Trackapp in-place.",
      ].join("\n");
    })
    .join("\n\n");

  const downloadAllScript = resources
    .map((r) => {
      const zip = resourceZipFilename(r);
      const zipUrl = resourceZipPublicUrl(r, origin);
      const destDir = `ThirdPartyUI/Trackapp/${r.id}/`;
      return [
        `mkdir -p "${destDir}"`,
        `curl -sfL -o "${destDir}${zip}" "${zipUrl}"`,
        `unzip -o -q "${destDir}${zip}" -d "${destDir}"`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "# TRACKAPP UI LIBRARY — Ressources préfabriquées",
    "",
    "Tu **dois** intégrer les composants SwiftUI Trackapp ci-dessous. Chaque ZIP contient du code prêt à adapter.",
    "",
    "## Accès fichiers (Cursor / Claude / terminal)",
    "Les ZIP et vidéos sont servis **publiquement** sur `https://www.trackapp.fr` — pas besoin de cookie ni login.",
    "Si un téléchargement échoue (404), implémenter le funnel à partir de UX_FLOWS.md sans bloquer sur les ZIP.",
    "",
    `- **Manifest complet :** ${manifestUrl}`,
    `- **Dossier cible dans le projet utilisateur :** \`ThirdPartyUI/Trackapp/\``,
    "",
    "### Étape 0 — Télécharger toutes les ressources du projet",
    "```bash",
    downloadAllScript,
    "```",
    "",
    "### Workflow IDE (obligatoire)",
    "1. Exécute le script ci-dessus **avant** d'écrire les écrans funnel.",
    "2. Ouvre chaque vidéo démo (URL ci-dessous) pour caler le rendu visuel.",
    "3. Pour chaque ZIP : lis les fichiers .swift → extrais la **structure View** → recrée dans `Features/{Funnel}/` avec le naming `{AppName}*`.",
    "4. Branche le paywall sur **RevenueCat** (`Purchases.shared`) — `logIn(firebaseUid)` après Firebase Auth.",
    "5. Ne commit **pas** les ZIP bruts : ajoute `ThirdPartyUI/Trackapp/*.zip` au `.gitignore`, garde le code adapté.",
    "",
    "## Règles d'intégration",
    "- Couleurs → design tokens du projet (`AppColors`, `Theme`).",
    `- Copy → français, ton adapté à **${appName}**.`,
    "- Assets/logo Trackapp → remplacer par l'identité de l'app.",
    "- Navigation funnel : voir UX_FLOWS.md — un écran = une ressource principale quand possible.",
    "",
    "## Funnel client obligatoire (first-run)",
    bulletList(
      TRACKAPP_CLIENT_FUNNEL_STAGES.map(
        (s) => `**${s.screen_id}** (${s.stage}) — ${s.purpose}`,
      ),
    ),
    "",
    "## Navigation & états",
    bulletList([...CLIENT_FUNNEL_NAV_RULES]),
    "",
    "## Ressources sélectionnées pour ce projet",
    resourceBlocks,
    "",
    "## Mapping funnel → fichiers Swift cibles",
    "| Étape | Dossier cible | Action |",
    "|-------|---------------|--------|",
    "| welcome | `Features/Welcome/` | Splash depuis `custom_splash` |",
    "| onboarding | `Features/Onboarding/` | Pager 3–5 pages depuis ressource onboarding |",
    "| paywall | `Features/Paywall/` | RevenueCat + restore + legal |",
    "| winback_game | `Features/Winback/` | Animation jeu + offre remise |",
    "| home | `Features/Main/` | Tab bar + écrans métier |",
    "",
    "## Checklist intégration",
    "- [ ] ZIP téléchargés et dézippés (`ThirdPartyUI/Trackapp/`)",
    "- [ ] welcome : splash + transition vers onboarding",
    "- [ ] onboarding : 3–5 pages depuis ressource onboarding",
    "- [ ] paywall : RevenueCat + restore + legal links",
    "- [ ] winback_game : déclenché sur `paywall_dismiss` — animation + offre remise",
    "- [ ] home : tab bar + core feature screens",
    "- [ ] Tous les composants Trackapp adaptés (pas de copy-paste logo/texte d'origine)",
    "- [ ] `.gitignore` : exclure `ThirdPartyUI/Trackapp/*.zip`",
  ].join("\n");
}

export function buildClientFunnelUxSection(): string {
  return [
    "## Funnel client Trackapp (obligatoire)",
    "",
    "```",
    "welcome → onboarding (3-5) → paywall",
    "                              ├─ achat OK → home (accès complet)",
    "                              └─ dismiss/refus → winback_game → paywall_remise → home",
    "```",
    "",
    bulletList([...CLIENT_FUNNEL_NAV_RULES]),
  ].join("\n");
}
