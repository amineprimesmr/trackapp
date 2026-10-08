import { TrackerHeader } from "@/components/tracker/tracker-header";
import { TrackerFooter } from "@/components/tracker/tracker-footer";
import { TrackerNavigationProvider } from "@/components/tracker/tracker-navigation";
import { createClient } from "@/lib/supabase/server";
import "@/styles/shiny-cta-button.css";
import "@/styles/trackapp-purple.css";
import "@/styles/tracker-ux.css";

export default async function TrackerShellLayout({ children }: { children: React.ReactNode }) {
  const sb = await createClient();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  const loggedIn = Boolean(user);

  return (
    <TrackerNavigationProvider>
      <div
        data-tracker
        className="min-h-dvh bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.07),#000000)] font-sans text-white antialiased"
      >
        <TrackerHeader loggedIn={loggedIn} />
        <main className="pt-[var(--tracker-header-offset)]">{children}</main>
        <TrackerFooter loggedIn={loggedIn} />
      </div>
    </TrackerNavigationProvider>
  );
}
