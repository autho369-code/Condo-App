export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "portier-dev-secret",
  oauthServerUrl: process.env.OAUTH_SERVER_URL ?? "https://api.manus.im",
  oauthPortalUrl: process.env.VITE_OAUTH_PORTAL_URL ?? "https://manus.im",
  appId: process.env.VITE_APP_ID ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  ownerName: process.env.OWNER_NAME ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "https://forge.manus.ai",
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3000", 10),
  // Gmail OAuth
  gmailClientId: process.env.GMAIL_CLIENT_ID ?? "",
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
  // Outlook / Microsoft Graph OAuth
  outlookClientId: process.env.OUTLOOK_CLIENT_ID ?? "",
  outlookClientSecret: process.env.OUTLOOK_CLIENT_SECRET ?? "",
};
