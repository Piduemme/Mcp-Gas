import { createVersion, listDeployments, deployHead } from "../google-api/apps-script.js";

export const listDeploymentsTool = {
  name: "gas_list_deployments",
  description: "List all deployments for a Google Apps Script project",
  inputSchema: {
    type: "object" as const,
    properties: {
      scriptId: {
        type: "string",
        description: "The Script ID of the project",
      },
    },
    required: ["scriptId"],
  },
  handler: async (args: { scriptId: string }): Promise<string> => {
    const deployments = await listDeployments(args.scriptId);

    if (deployments.length === 0) {
      return "No deployments found for this project.";
    }

    const lines = deployments.map((d, i) => {
      const version = d.versionNumber ? `v${d.versionNumber}` : "HEAD";
      return `${i + 1}. **${d.description || "Unnamed"}** (${version})
   - Deployment ID: \`${d.deploymentId}\`
   - Updated: ${d.updateTime || "unknown"}`;
    });

    return `**Deployments (${deployments.length}):**\n\n${lines.join("\n\n")}`;
  },
};

export const deployTool = {
  name: "gas_deploy",
  description: "Create a new deployment for a Google Apps Script project",
  inputSchema: {
    type: "object" as const,
    properties: {
      scriptId: {
        type: "string",
        description: "The Script ID of the project",
      },
      description: {
        type: "string",
        description: "Description for this deployment",
      },
      createVersion: {
        type: "boolean",
        description: "Whether to create a new version (default: false, uses HEAD)",
      },
    },
    required: ["scriptId"],
  },
  handler: async (args: {
    scriptId: string;
    description?: string;
    createVersion?: boolean;
  }): Promise<string> => {
    if (args.createVersion) {
      const versionNumber = await createVersion(
        args.scriptId,
        args.description || "New version"
      );
      return `Created new version: v${versionNumber}`;
    } else {
      const deploymentId = await deployHead(args.scriptId);
      return `Deployed to HEAD\nDeployment ID: \`${deploymentId}\``;
    }
  },
};
