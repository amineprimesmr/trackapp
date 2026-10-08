import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mentions légales — Trackapp",
  description: "Mentions légales de l'éditeur Trackapp.",
};

export default function TrackappLegalNoticePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-14 text-[15px] leading-relaxed text-white/75">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/38">Légal</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Mentions légales</h1>
      <p className="mt-4 text-[13px] text-white/45">Dernière mise à jour : 11 juin 2026</p>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold text-white">Éditeur du site</h2>
        <p>
          Trackapp
          <br />
          Contact :{" "}
          <a href="mailto:hello@trackapp.fr" className="text-violet-300 underline-offset-2 hover:underline">
            hello@trackapp.fr
          </a>
        </p>
        <p className="text-[13px] text-white/45">
          Complétez ici la dénomination sociale, le SIREN/SIRET, le capital social et l&apos;adresse du siège avant
          diffusion commerciale à grande échelle.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-white">Directeur de la publication</h2>
        <p>Le représentant légal de l&apos;éditeur.</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-white">Hébergement</h2>
        <p>
          Vercel Inc.
          <br />
          440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
          <br />
          <a
            href="https://vercel.com"
            className="text-violet-300 underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            vercel.com
          </a>
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-white">Propriété intellectuelle</h2>
        <p>
          L&apos;ensemble du site Trackapp (textes, graphismes, logo, logiciels) est protégé par le droit d&apos;auteur.
          Toute reproduction non autorisée est interdite.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-white">Données personnelles</h2>
        <p>
          Consultez la{" "}
          <Link href="/trackapp/legal/privacy" className="text-violet-300 underline-offset-2 hover:underline">
            politique de confidentialité
          </Link>{" "}
          pour connaître vos droits (accès, rectification, suppression) au sens du RGPD.
        </p>
      </section>

      <p className="mt-12 text-[13px] text-white/40">
        <Link href="/trackapp/legal/terms" className="text-violet-300 underline-offset-2 hover:underline">
          Conditions générales
        </Link>
        {" · "}
        <Link href="/trackapp/legal/privacy" className="text-violet-300 underline-offset-2 hover:underline">
          Politique de confidentialité
        </Link>
      </p>
    </main>
  );
}
