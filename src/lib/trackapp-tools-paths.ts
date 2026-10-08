export const TRACKAPP_APPTRACKER_PATH = "/trackapp/apptracker";
export const TRACKAPP_MARKETING_PATH = "/trackapp/marketing";
/** @deprecated Redirige vers `/trackapp/marketing#ads`. */
export const TRACKAPP_ADS_PATH = "/trackapp/ads";
/** @deprecated Redirige vers `/trackapp/marketing#organique`. */
export const TRACKAPP_ORGANIQUE_PATH = "/trackapp/organique";

export function isTrackappMarketingPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === TRACKAPP_MARKETING_PATH || path.startsWith(`${TRACKAPP_MARKETING_PATH}/`);
}

export function isTrackappApptrackerPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === TRACKAPP_APPTRACKER_PATH || path.startsWith(`${TRACKAPP_APPTRACKER_PATH}/`);
}

export function isTrackappAdsPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === TRACKAPP_ADS_PATH || path.startsWith(`${TRACKAPP_ADS_PATH}/`);
}

export function isTrackappOrganiquePath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === TRACKAPP_ORGANIQUE_PATH || path.startsWith(`${TRACKAPP_ORGANIQUE_PATH}/`);
}
