import {
  getCloudLogs,
  resolveGcpProjectId,
  ExecutionLogs,
} from "../google-api/cloud-logging.js";
import { hasServiceAccount } from "../config/config-manager.js";

export const getCloudLogsTool = {
  name: "gas_get_cloud_logs",
  description:
    "Get detailed Cloud Logging logs for Google Apps Script executions. " +
    "Shows console.log(), console.error(), and other log output from the last 2 function executions. " +
    "Requires a service account to be configured (use gas_setup_service_account first).",
  inputSchema: {
    type: "object" as const,
    properties: {
      scriptId: {
        type: "string",
        description: "The Script ID of the Apps Script project",
      },
      gcpProjectId: {
        type: "string",
        description:
          "The GCP Project ID (optional if already saved). Find it in Google Cloud Console → Dashboard",
      },
      executionCount: {
        type: "number",
        description: "Number of recent executions to fetch logs for (default: 2)",
      },
    },
    required: ["scriptId"],
  },
  handler: async (args: {
    scriptId: string;
    gcpProjectId?: string;
    executionCount?: number;
  }): Promise<string> => {
    // Check service account
    if (!hasServiceAccount()) {
      return (
        "**Service account not configured**\n\n" +
        "Please use `gas_setup_service_account` first to configure Cloud Logging access.\n\n" +
        "You need to:\n" +
        "1. Create a service account in GCP Console\n" +
        "2. Grant it 'Logs Viewer' role\n" +
        "3. Download the JSON key\n" +
        "4. Use `gas_setup_service_account` with the JSON content"
      );
    }

    // Resolve GCP Project ID
    const projectIdResult = await resolveGcpProjectId(
      args.scriptId,
      args.gcpProjectId
    );

    if (projectIdResult.needsInput) {
      return (
        "**GCP Project ID required**\n\n" +
        projectIdResult.message +
        "\n\n" +
        "Please call this tool again with the `gcpProjectId` parameter."
      );
    }

    const gcpProjectId = projectIdResult.projectId!;
    const executionCount = args.executionCount || 2;

    try {
      const executionLogs = await getCloudLogs(
        args.scriptId,
        gcpProjectId,
        executionCount
      );

      if (executionLogs.length === 0) {
        return (
          "**No recent executions found**\n\n" +
          "No function executions were found for this script. " +
          "Try running a function first using `gas_run_function`."
        );
      }

      return formatExecutionLogs(executionLogs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `**Failed to fetch Cloud Logs**\n\nError: ${message}`;
    }
  },
};

function formatExecutionLogs(executions: ExecutionLogs[]): string {
  const sections = executions.map((exec, index) => {
    const statusIcon = exec.status === "COMPLETED" ? "✅" : "❌";
    const header =
      `### Execution ${index + 1}: ${exec.functionName}() ${statusIcon}\n` +
      `- **Status**: ${exec.status}\n` +
      `- **Started**: ${exec.startTime}\n` +
      `- **Execution ID**: \`${exec.executionId}\`\n`;

    if (exec.logs.length === 0) {
      return header + "\n*No log entries found for this execution*";
    }

    const logLines = exec.logs.map((log) => {
      const severityIcon = getSeverityIcon(log.severity);
      const timestamp = log.timestamp
        ? new Date(log.timestamp).toISOString().substring(11, 23)
        : "";
      return `${severityIcon} \`${timestamp}\` ${log.message}`;
    });

    return header + "\n**Logs:**\n" + logLines.join("\n");
  });

  return `## Cloud Logs (Last ${executions.length} Executions)\n\n${sections.join("\n\n---\n\n")}`;
}

function getSeverityIcon(severity: string): string {
  switch (severity.toUpperCase()) {
    case "DEBUG":
      return "🔍";
    case "INFO":
      return "ℹ️";
    case "NOTICE":
      return "📌";
    case "WARNING":
      return "⚠️";
    case "ERROR":
      return "❌";
    case "CRITICAL":
      return "🔥";
    case "ALERT":
      return "🚨";
    case "EMERGENCY":
      return "💀";
    default:
      return "📝";
  }
}
