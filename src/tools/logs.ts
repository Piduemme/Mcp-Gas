import { getExecutionLogs } from "../google-api/apps-script.js";

export const getLogsTool = {
  name: "gas_get_logs",
  description:
    "Get execution logs (history) for a Google Apps Script project. " +
    "Shows function calls, execution status, duration, and errors.",
  inputSchema: {
    type: "object" as const,
    properties: {
      scriptId: {
        type: "string",
        description: "The Script ID of the project",
      },
      limit: {
        type: "number",
        description: "Maximum number of log entries to return (default: 20)",
      },
    },
    required: ["scriptId"],
  },
  handler: async (args: { scriptId: string; limit?: number }): Promise<string> => {
    const logs = await getExecutionLogs(args.scriptId, args.limit || 20);

    if (logs.length === 0) {
      return "No execution logs found for this project.";
    }

    const entries = logs.map((log, i) => {
      const status = log.status === "COMPLETED" ? "SUCCESS" : log.status;
      const statusIcon = status === "SUCCESS" ? "" : "";
      const errorLine = log.error ? `\n   Error: ${log.error}` : "";

      return `${i + 1}. ${statusIcon} **${log.functionName}()** - ${status}
   Started: ${log.startTime}
   Duration: ${log.duration}${errorLine}`;
    });

    return `**Execution Logs (${logs.length} entries):**\n\n${entries.join("\n\n")}`;
  },
};
