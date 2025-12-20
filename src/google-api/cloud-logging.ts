import { google } from "googleapis";
import * as fs from "fs";
import {
  getServiceAccountPath,
  hasServiceAccount,
  getGcpProjectId,
  saveGcpProjectId,
} from "../config/config-manager.js";
import { getAppsScriptService } from "../auth/clasp-auth.js";

export interface CloudLogEntry {
  timestamp: string;
  severity: string;
  message: string;
  functionName?: string;
  executionId?: string;
}

export interface ExecutionLogs {
  executionId: string;
  functionName: string;
  startTime: string;
  endTime?: string;
  status: string;
  logs: CloudLogEntry[];
}

// Create authenticated Cloud Logging client using service account
function getLoggingService() {
  if (!hasServiceAccount()) {
    throw new Error(
      "Service account not configured. Use gas_setup_service_account first."
    );
  }

  const serviceAccountPath = getServiceAccountPath();
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf-8")
  );

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/logging.read"],
  });

  return google.logging({ version: "v2", auth });
}

// Try to get GCP project ID from Apps Script project metadata
export async function detectGcpProjectId(
  scriptId: string
): Promise<string | undefined> {
  try {
    const script = getAppsScriptService();
    const response = await script.projects.get({ scriptId });

    // The parentId might be the GCP project number or Drive folder
    // We need to check if it's a GCP project
    const parentId = response.data.parentId;

    if (parentId) {
      // Try to use it as a project ID
      // This is a heuristic - parentId is usually the Drive folder, not GCP project
      // For now, we'll return undefined and ask the user
    }

    return undefined;
  } catch {
    return undefined;
  }
}

// Get the last N execution IDs from the processes API
async function getLastExecutionIds(
  scriptId: string,
  count: number
): Promise<Array<{ executionId: string; functionName: string; startTime: string; status: string }>> {
  const script = getAppsScriptService();

  const response = await script.processes.list({
    userProcessFilter: {
      scriptId: scriptId,
    },
    pageSize: count,
  } as any);

  const processes = response.data.processes || [];

  return processes.map((p: any) => ({
    executionId: p.processId || "",
    functionName: p.functionName || "unknown",
    startTime: p.startTime || "",
    status: p.processStatus || "UNKNOWN",
  }));
}

// Fetch Cloud Logging entries for specific executions
export async function getCloudLogs(
  scriptId: string,
  gcpProjectId: string,
  executionCount: number = 2
): Promise<ExecutionLogs[]> {
  const logging = getLoggingService();

  // Get the last N executions
  const executions = await getLastExecutionIds(scriptId, executionCount);

  if (executions.length === 0) {
    return [];
  }

  const results: ExecutionLogs[] = [];

  for (const execution of executions) {
    // Build filter for this execution
    // Apps Script logs are in the "script.googleapis.com" resource
    const filter = [
      `resource.type="app_script_function"`,
      `resource.labels.function_name="${execution.functionName}"`,
      `timestamp>="${execution.startTime}"`,
    ].join(" AND ");

    try {
      const response = await logging.entries.list({
        requestBody: {
          resourceNames: [`projects/${gcpProjectId}`],
          filter: filter,
          orderBy: "timestamp asc",
          pageSize: 1000, // No limit as per user request
        },
      });

      const entries = (response.data.entries || []).map((entry: any) => ({
        timestamp: entry.timestamp || "",
        severity: entry.severity || "DEFAULT",
        message: extractMessage(entry),
        functionName: entry.resource?.labels?.function_name,
        executionId: entry.labels?.["execution_id"],
      }));

      results.push({
        executionId: execution.executionId,
        functionName: execution.functionName,
        startTime: execution.startTime,
        status: execution.status,
        logs: entries,
      });
    } catch (error: any) {
      // If we can't get logs for this execution, still include it with empty logs
      results.push({
        executionId: execution.executionId,
        functionName: execution.functionName,
        startTime: execution.startTime,
        status: execution.status,
        logs: [
          {
            timestamp: "",
            severity: "ERROR",
            message: `Failed to fetch logs: ${error.message}`,
          },
        ],
      });
    }
  }

  return results;
}

// Extract the message from various log entry formats
function extractMessage(entry: any): string {
  // textPayload is the simplest case
  if (entry.textPayload) {
    return entry.textPayload;
  }

  // jsonPayload for structured logs
  if (entry.jsonPayload) {
    if (entry.jsonPayload.message) {
      return entry.jsonPayload.message;
    }
    return JSON.stringify(entry.jsonPayload);
  }

  // protoPayload for audit logs
  if (entry.protoPayload) {
    if (entry.protoPayload.status?.message) {
      return entry.protoPayload.status.message;
    }
    return JSON.stringify(entry.protoPayload);
  }

  return "(no message)";
}

// Get or prompt for GCP Project ID
export async function resolveGcpProjectId(
  scriptId: string,
  providedProjectId?: string
): Promise<{ projectId?: string; needsInput: boolean; message?: string }> {
  // If provided, save and use it
  if (providedProjectId) {
    saveGcpProjectId(scriptId, providedProjectId);
    return { projectId: providedProjectId, needsInput: false };
  }

  // Check if we have a saved mapping
  const savedProjectId = getGcpProjectId(scriptId);
  if (savedProjectId) {
    return { projectId: savedProjectId, needsInput: false };
  }

  // Try to auto-detect
  const detectedProjectId = await detectGcpProjectId(scriptId);
  if (detectedProjectId) {
    saveGcpProjectId(scriptId, detectedProjectId);
    return { projectId: detectedProjectId, needsInput: false };
  }

  // Need user input
  return {
    needsInput: true,
    message:
      "Could not auto-detect GCP Project ID. Please provide the gcpProjectId parameter. " +
      "You can find it in Google Cloud Console → Dashboard → Project ID",
  };
}
