export type EnvConfig = {
  backendUrl: string;
  /** ProgCompJOlivaApi base url, users sign in there */
  progcompApiUrl: string;
  isDevelopment: boolean;
  clientVersion: string;
  recaptchaSiteKey: string;
  quickLoginEmail: string | undefined;
  quickLoginPassword: string | undefined;
};

declare module "virtual:env-config" {
  export const envConfig: EnvConfig;
}
