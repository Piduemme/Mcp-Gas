import { listProjects, getProjectContent, type GasProject, type GasFile } from "../google-api/apps-script.js";

export const listProjectsTool = {
  name: "gas_list_projects",
  description: "List all Google Apps Script projects accessible with your account",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
  handler: async (): Promise<string> => {
    const projects = await listProjects();

    if (projects.length === 0) {
      return "No Google Apps Script projects found.";
    }

    const lines = projects.map((p, i) =>
      `${i + 1}. **${p.title}**\n   - Script ID: \`${p.scriptId}\`\n   - Last modified: ${p.updateTime || "unknown"}`
    );

    return `Found ${projects.length} projects:\n\n${lines.join("\n\n")}`;
  },
};

export const getProjectTool = {
  name: "gas_get_project",
  description: "Get details and file list of a specific Google Apps Script project",
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
    const { project, files } = await getProjectContent(args.scriptId);

    const fileList = files.map((f) => {
      const ext = f.type === "HTML" ? ".html" : f.type === "JSON" ? ".json" : ".gs";
      return `- ${f.name}${ext} (${f.type})`;
    }).join("\n");

    return `**Project: ${project.title}**
- Script ID: \`${project.scriptId}\`
- Created: ${project.createTime || "unknown"}
- Last modified: ${project.updateTime || "unknown"}

**Files (${files.length}):**
${fileList}`;
  },
};
