"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  loadApplabDraftFromServer,
  saveApplabDraftToServer,
  saveApplabPromptVersionToServer,
} from "@/lib/trackapp-applab-create/applab-draft-store";
import type { ApplabPromptVersion } from "@/lib/trackapp-applab-create/mvp-prompt-types";
import type { ApplabCreateDraft } from "@/lib/trackapp-applab-create/types";
import { createClient } from "@/lib/supabase/client";

const SYNC_DEBOUNCE_MS = 1200;

export function useApplabDraftSync(
  draft: ApplabCreateDraft,
  onRemoteDraft: (draft: ApplabCreateDraft) => void,
) {
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRemote = useRef(false);

  useEffect(() => {
    if (hydratedRemote.current) return;
    hydratedRemote.current = true;

    void (async () => {
      const sb = createClient();
      if (!sb) return;
      const { data: auth } = await sb.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      try {
        const res = await fetch("/api/trackapp/applab/draft");
        if (res.ok) {
          const data = (await res.json()) as {
            draft?: ApplabCreateDraft;
            versions?: ApplabPromptVersion[];
          };
          if (data.draft) {
            const remote = data.draft;
            const remoteVersions = data.versions ?? remote.promptVersions ?? [];
            const merged: ApplabCreateDraft = {
              ...remote,
              promptVersions:
                remoteVersions.length > remote.promptVersions.length ?
                  remoteVersions
                : remote.promptVersions,
              activePromptVersionId:
                remote.activePromptVersionId ?? remoteVersions[0]?.id ?? null,
              syncedAt: new Date().toISOString(),
            };
            const localUpdated = new Date(draft.updatedAt).getTime();
            const remoteUpdated = new Date(merged.updatedAt ?? 0).getTime();
            if (remoteUpdated >= localUpdated) {
              onRemoteDraft(merged);
              return;
            }
          }
        }
      } catch {
        /* fallback localStorage */
      }

      const remote = await loadApplabDraftFromServer(sb, userId);
      if (!remote) return;

      const localUpdated = new Date(draft.updatedAt).getTime();
      const remoteUpdated = new Date(remote.updatedAt ?? 0).getTime();
      if (remoteUpdated > localUpdated) {
        onRemoteDraft({ ...remote, syncedAt: new Date().toISOString() });
      }
    })();
  }, [draft.updatedAt, onRemoteDraft]);

  const pushDraft = useCallback(
    (next: ApplabCreateDraft) => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        void (async () => {
          const sb = createClient();
          if (!sb) return;
          const { data: auth } = await sb.auth.getUser();
          const userId = auth.user?.id;
          if (!userId) return;
          await saveApplabDraftToServer(sb, userId, {
            ...next,
            syncedAt: new Date().toISOString(),
          });
        })();
      }, SYNC_DEBOUNCE_MS);
    },
    [],
  );

  const pushPromptVersion = useCallback(async (version: ApplabPromptVersion) => {
    const sb = createClient();
    if (!sb) return;
    const { data: auth } = await sb.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    await saveApplabPromptVersionToServer(sb, userId, version);
  }, []);

  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    },
    [],
  );

  return { pushDraft, pushPromptVersion };
}
