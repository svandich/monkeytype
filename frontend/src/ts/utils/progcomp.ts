import { envConfig } from "virtual:env-config";

const DEFAULT_SITE_URL = "https://progcomp.joliva.cl";

/** the ProgCompJOliva website, accounts and the rankings live there */
export function getProgcompSiteUrl(): string {
  const url = envConfig.progcompSiteUrl;
  // docker builds keep a placeholder that is replaced on container start
  if (url === "" || url.startsWith("###")) return DEFAULT_SITE_URL;
  return url.replace(/\/+$/, "");
}

export function getProgcompProfileUrl(nickname: string): string {
  return `${getProgcompSiteUrl()}/profile/${encodeURIComponent(nickname)}`;
}

/** turns a path served by ProgCompJOlivaApi (e.g. an organization logo) into an url */
export function getProgcompApiAssetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${envConfig.progcompApiUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * ProgCompJOliva nicknames are the users' real handles, monkeytype names are
 * slugs derived from them (max 16 chars), so prefer the nickname when known.
 * Profile urls keep using the monkeytype name.
 */
export function getDisplayName(user: {
  name: string;
  progcompNickname?: string;
  progcomp?: { nickname: string };
}): string {
  return user.progcompNickname ?? user.progcomp?.nickname ?? user.name;
}
