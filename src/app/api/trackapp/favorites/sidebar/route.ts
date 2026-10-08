import { NextResponse } from "next/server";

import { fetchAppDetailCrossRequestCached } from "@/lib/tracker-server-cache";
import { loadProfileFavorites } from "@/lib/trackapp-profile-favorites-store";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIDEBAR_APPS = 12;

export async function GET() {
  const sb = await createClient();
  if (!sb) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ apps: [] });
  }

  const current = await loadProfileFavorites(sb, user.id);
  if (current.storageError) {
    return NextResponse.json({ error: current.storageError }, { status: 500 });
  }

  const appIds = [...current.appIds].reverse().slice(0, MAX_SIDEBAR_APPS);

  const appRows = await Promise.all(
    appIds.map(async (id) => {
      const detail = await fetchAppDetailCrossRequestCached(id, "fr");
      if (!detail) return null;
      return {
        id: detail.id,
        name: detail.name,
        artworkUrl: detail.artworkUrl ?? null,
      };
    }),
  );

  return NextResponse.json({
    apps: appRows.filter((r): r is NonNullable<typeof r> => r != null),
  });
}
