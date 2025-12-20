import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Config file paths
const MCP_GAS_CONFIG_DIR = path.join(os.homedir(), ".mcp-gas");
const CONFIG_FILE = path.join(MCP_GAS_CONFIG_DIR, "config.json");
const SERVICE_ACCOUNT_FILE = path.join(
  process.cwd(),
  "service-account.json"
);

export interface McpGasConfig {
  // Mapping scriptId -> gcpProjectId
  scriptProjectMappings: Record<string, string>;
}

// Ensure config directory exists
function ensureConfigDir(): void {
  if (!fs.existsSync(MCP_GAS_CONFIG_DIR)) {
    fs.mkdirSync(MCP_GAS_CONFIG_DIR, { recursive: true });
  }
}

// Load config from file
export function loadConfig(): McpGasConfig {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    return { scriptProjectMappings: {} };
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(content) as McpGasConfig;
  } catch {
    return { scriptProjectMappings: {} };
  }
}

// Save config to file
export function saveConfig(config: McpGasConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

// Get GCP Project ID for a script
export function getGcpProjectId(scriptId: string): string | undefined {
  const config = loadConfig();
  return config.scriptProjectMappings[scriptId];
}

// Save GCP Project ID mapping for a script
export function saveGcpProjectId(scriptId: string, gcpProjectId: string): void {
  const config = loadConfig();
  config.scriptProjectMappings[scriptId] = gcpProjectId;
  saveConfig(config);
}

// Check if service account file exists
export function hasServiceAccount(): boolean {
  return fs.existsSync(SERVICE_ACCOUNT_FILE);
}

// Get service account file path
export function getServiceAccountPath(): string {
  return SERVICE_ACCOUNT_FILE;
}

// Save service account JSON
export function saveServiceAccount(jsonContent: string): { success: boolean; error?: string } {
  try {
    // Validate JSON
    const parsed = JSON.parse(jsonContent);

    // Basic validation of service account structure
    if (!parsed.type || parsed.type !== "service_account") {
      return {
        success: false,
        error: "Invalid service account JSON: missing or invalid 'type' field"
      };
    }

    if (!parsed.project_id) {
      return {
        success: false,
        error: "Invalid service account JSON: missing 'project_id' field"
      };
    }

    if (!parsed.private_key) {
      return {
        success: false,
        error: "Invalid service account JSON: missing 'private_key' field"
      };
    }

    if (!parsed.client_email) {
      return {
        success: false,
        error: "Invalid service account JSON: missing 'client_email' field"
      };
    }

    // Save the file
    fs.writeFileSync(SERVICE_ACCOUNT_FILE, JSON.stringify(parsed, null, 2), "utf-8");

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Failed to parse JSON: ${message}` };
  }
}

// Get service account project ID (from the service account file itself)
export function getServiceAccountProjectId(): string | undefined {
  if (!hasServiceAccount()) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(SERVICE_ACCOUNT_FILE, "utf-8");
    const parsed = JSON.parse(content);
    return parsed.project_id;
  } catch {
    return undefined;
  }
}
