export type EnvConfig = {
  backendUrl: string;
  /** ProgCompJOlivaApi base url, users sign in there */
  progcompApiUrl: string;
  isDevelopment: boolean;
  clientVersion: string;
  /** "true" makes every page except the login page require signing in */
  requireLogin: string;
  quickLoginEmail: string | undefined;
  quickLoginPassword: string | undefined;
};

declare module "virtual:env-config" {
  export const envConfig: EnvConfig;
}
