import type { Metadata } from "next";

import { TrackappMarketingStudio } from "@/components/trackapp/trackapp-marketing-studio";

export const metadata: Metadata = {
  title: "Marketing Studio — Trackapp",
  description: "Acquisition payante et organique — Ads Meta, Instagram et TikTok.",
};

export default function TrackappMarketingPage() {
  return <TrackappMarketingStudio />;
}
