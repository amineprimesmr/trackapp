import Link from "next/link";

import { TrackappLogoMark } from "@/components/trackapp/trackapp-logo-mark";
import { TRACKAPP_LANDING_PATH } from "@/lib/trackapp-landing-paths";

import "@/styles/trackapp-landing-footer.css";

const FOOTER_NAV = [
  { href: `${TRACKAPP_LANDING_PATH}#landing-top`, label: "Programme" },
  { href: `${TRACKAPP_LANDING_PATH}#applab`, label: "Process" },
  { href: `${TRACKAPP_LANDING_PATH}#contenu-concurrents`, label: "L'Équipe" },
  { href: `${TRACKAPP_LANDING_PATH}#offre`, label: "Rejoindre" },
  { href: "/trackapp/paiement#community-title", label: "Avis" },
  { href: `${TRACKAPP_LANDING_PATH}#faq`, label: "FAQ" },
] as const;

const FOOTER_LEGAL = [
  { href: "/trackapp/legal/cgu", label: "Mentions légales" },
  { href: "/trackapp/legal/terms", label: "Conditions générales" },
  { href: "/trackapp/legal/confidentialite", label: "Politique de confidentialité" },
] as const;

const FOOTER_EMAIL = "hello@trackapp.fr";
const WHATSAPP_HREF = process.env.NEXT_PUBLIC_WHATSAPP_URL?.trim();

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function FooterLinkList({ links }: Readonly<{ links: ReadonlyArray<{ href: string; label: string }> }>) {
  return (
    <ul className="ta-landing-footer__links">
      {links.map(({ href, label }) => (
        <li key={href + label}>
          <Link href={href} className="ta-landing-footer__link" prefetch={href.startsWith("/") && !href.includes("#")}>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Pied de page landing — réf. 8lab (mobile + desktop 3 colonnes). */
export function TrackappLandingFooter() {
  const year = new Date().getFullYear();

  return (
    <>
      <footer className="ta-landing-footer" aria-label="Pied de page">
        <div className="ta-landing-footer__inner">
          <div className="ta-landing-footer__grid">
            <div className="ta-landing-footer__brand-col">
              <Link href={TRACKAPP_LANDING_PATH} className="ta-landing-footer__brand" prefetch>
                <TrackappLogoMark size="sm" decorative />
                <span className="ta-landing-footer__brand-name">Trackapp</span>
              </Link>
              <a className="ta-landing-footer__email" href={`mailto:${FOOTER_EMAIL}`}>
                {FOOTER_EMAIL}
              </a>
            </div>

            <section className="ta-landing-footer__block" aria-labelledby="ta-landing-footer-nav">
              <h2 id="ta-landing-footer-nav" className="ta-landing-footer__block-title">
                Navigation
              </h2>
              <FooterLinkList links={FOOTER_NAV} />
            </section>

            <section className="ta-landing-footer__block" aria-labelledby="ta-landing-footer-info">
              <h2 id="ta-landing-footer-info" className="ta-landing-footer__block-title">
                Informations
              </h2>
              <FooterLinkList links={FOOTER_LEGAL} />
            </section>
          </div>

          <div className="ta-landing-footer__legal">
            <p className="ta-landing-footer__copyright">
              © {year} Trackapp — All rights reserved
            </p>
          </div>
        </div>
      </footer>

      <a
        href={WHATSAPP_HREF ?? "#"}
        className="ta-landing-footer__whatsapp"
        target={WHATSAPP_HREF ? "_blank" : undefined}
        rel={WHATSAPP_HREF ? "noopener noreferrer" : undefined}
        aria-label="Contacter Trackapp sur WhatsApp"
        aria-disabled={WHATSAPP_HREF ? undefined : true}
        onClick={WHATSAPP_HREF ? undefined : (event) => event.preventDefault()}
      >
        <WhatsAppIcon />
      </a>
    </>
  );
}
