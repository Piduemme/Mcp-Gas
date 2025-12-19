import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { google } from "googleapis";

interface ClaspCredentials {
  token: {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  };
  oauth2ClientSettings: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  isLocalCreds: boolean;
}

const CLASP_CREDENTIALS_PATH = join(homedir(), ".clasprc.json");

export function getClaspCredentials(): ClaspCredentials {
  if (!existsSync(CLASP_CREDENTIALS_PATH)) {
    throw new Error(
      `Clasp credentials not found at ${CLASP_CREDENTIALS_PATH}. ` +
      `Please run 'clasp login' first.`
    );
  }

  const content = readFileSync(CLASP_CREDENTIALS_PATH, "utf-8");
  return JSON.parse(content) as ClaspCredentials;
}

export function createOAuth2Client() {
  const credentials = getClaspCredentials();

  const oauth2Client = new google.auth.OAuth2(
    credentials.oauth2ClientSettings.clientId,
    credentials.oauth2ClientSettings.clientSecret,
    credentials.oauth2ClientSettings.redirectUri
  );

  oauth2Client.setCredentials({
    access_token: credentials.token.access_token,
    refresh_token: credentials.token.refresh_token,
    expiry_date: credentials.token.expiry_date,
  });

  // Auto-refresh token when expired
  oauth2Client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      // Token refreshed, could save to file if needed
      console.error("[MCP-GAS] Token refreshed successfully");
    }
  });

  return oauth2Client;
}

export function getAppsScriptService() {
  const auth = createOAuth2Client();
  return google.script({ version: "v1", auth });
}

export function getDriveService() {
  const auth = createOAuth2Client();
  return google.drive({ version: "v3", auth });
}
