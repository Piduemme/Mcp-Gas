import {
  saveServiceAccount,
  hasServiceAccount,
  getServiceAccountPath,
  getServiceAccountProjectId,
} from "../config/config-manager.js";

export const setupServiceAccountTool = {
  name: "gas_setup_service_account",
  description:
    "Save a Google Cloud Service Account JSON for Cloud Logging access. " +
    "Paste the full JSON content of your service account key file. " +
    "The service account needs 'Logs Viewer' role in GCP.",
  inputSchema: {
    type: "object" as const,
    properties: {
      jsonContent: {
        type: "string",
        description:
          "The full JSON content of the service account key file (copy-paste the entire file content)",
      },
    },
    required: ["jsonContent"],
  },
  handler: async (args: { jsonContent: string }): Promise<string> => {
    const result = saveServiceAccount(args.jsonContent);

    if (!result.success) {
      return `**Failed to save service account**\n\nError: ${result.error}`;
    }

    const projectId = getServiceAccountProjectId();

    return (
      `**Service account saved successfully!**\n\n` +
      `- File: \`${getServiceAccountPath()}\`\n` +
      `- Project ID: \`${projectId}\`\n\n` +
      `You can now use \`gas_get_cloud_logs\` to retrieve execution logs.`
    );
  },
};

export const checkServiceAccountTool = {
  name: "gas_check_service_account",
  description: "Check if a service account is configured for Cloud Logging",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
  handler: async (): Promise<string> => {
    if (!hasServiceAccount()) {
      return (
        `**No service account configured**\n\n` +
        `Use \`gas_setup_service_account\` to configure one.\n\n` +
        `You need a service account with 'Logs Viewer' role to access Cloud Logging.`
      );
    }

    const projectId = getServiceAccountProjectId();
    const filePath = getServiceAccountPath();

    return (
      `**Service account configured**\n\n` +
      `- File: \`${filePath}\`\n` +
      `- Project ID: \`${projectId}\``
    );
  },
};
