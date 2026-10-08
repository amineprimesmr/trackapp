import { TrackerLaunchFaq } from "@/components/tracker/tracker-launch-faq";

import "@/styles/myfid-launch-steps.css";

const DEFAULT_CTA_HREF = "/offers";

/** Section « Lancez-vous rapidement » — FAQ + CTA workspace. */
export function MyfidLaunchStepsSection({
  ctaHref = DEFAULT_CTA_HREF,
}: {
  ctaHref?: string;
}) {
  return (
    <section
      id="lancez-vous-rapidement"
      className="landing-launch-sf scroll-mt-[calc(var(--tracker-header-offset)+1rem)]"
      aria-labelledby="landing-launch-heading"
    >
      <div className="landing-launch-sf-inner">
        <h2 id="landing-launch-heading" className="landing-launch-sf-heading">
          Lancez-vous rapidement
        </h2>
        <div className="landing-launch-sf-grid landing-launch-sf-grid--solo">
          <div className="landing-launch-sf-steps-wrap">
            <TrackerLaunchFaq />
            <a className="landing-launch-sf-cta" href={ctaHref}>
              Commencer maintenant
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
