import {
  getProjectContent,
  updateProjectContent,
  deployHead,
  type GasFile,
} from "../google-api/apps-script.js";
import { commitAndPush } from "../github/git-sync.js";

export const readFileTool = {
  name: "gas_read_file",
  description: "Read the source code of a specific file in a Google Apps Script project",
  inputSchema: {
    type: "object" as const,
    properties: {
      scriptId: {
        type: "string",
        description: "The Script ID of the project",
      },
      fileName: {
        type: "string",
        description: "The name of the file to read (without extension, e.g., 'Code' not 'Code.gs')",
      },
    },
    required: ["scriptId", "fileName"],
  },
  handler: async (args: { scriptId: string; fileName: string }): Promise<string> => {
    const { files } = await getProjectContent(args.scriptId);

    const file = files.find((f) => f.name === args.fileName);

    if (!file) {
      const available = files.map((f) => f.name).join(", ");
      return `File '${args.fileName}' not found. Available files: ${available}`;
    }

    const ext = file.type === "HTML" ? ".html" : file.type === "JSON" ? ".json" : ".gs";

    return `**File: ${file.name}${ext}**\n\`\`\`${file.type === "HTML" ? "html" : "javascript"}\n${file.source}\n\`\`\``;
  },
};

export const readAllFilesTool = {
  name: "gas_read_all_files",
  description: "Read all source files from a Google Apps Script project",
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

    const output: string[] = [`# Project: ${project.title}\n`];

    for (const file of files) {
      const ext = file.type === "HTML" ? ".html" : file.type === "JSON" ? ".json" : ".gs";
      const lang = file.type === "HTML" ? "html" : "javascript";
      output.push(`## ${file.name}${ext}\n\`\`\`${lang}\n${file.source}\n\`\`\`\n`);
    }

    return output.join("\n");
  },
};

export const updateFileTool = {
  name: "gas_update_file",
  description:
    "Update the source code of a file in a Google Apps Script project. Automatically deploys and syncs to GitHub.",
  inputSchema: {
    type: "object" as const,
    properties: {
      scriptId: {
        type: "string",
        description: "The Script ID of the project",
      },
      fileName: {
        type: "string",
        description: "The name of the file to update (without extension)",
      },
      source: {
        type: "string",
        description: "The new source code for the file",
      },
      commitMessage: {
        type: "string",
        description: "Git commit message for this change",
      },
      githubRepo: {
        type: "string",
        description: "Optional: GitHub repo path (e.g., 'username/repo') for syncing",
      },
    },
    required: ["scriptId", "fileName", "source"],
  },
  handler: async (args: {
    scriptId: string;
    fileName: string;
    source: string;
    commitMessage?: string;
    githubRepo?: string;
  }): Promise<string> => {
    // Get current project content
    const { project, files } = await getProjectContent(args.scriptId);

    // Find and update the file
    const fileIndex = files.findIndex((f) => f.name === args.fileName);

    if (fileIndex === -1) {
      const available = files.map((f) => f.name).join(", ");
      return `File '${args.fileName}' not found. Available files: ${available}`;
    }

    files[fileIndex].source = args.source;

    // Update project content
    await updateProjectContent(args.scriptId, files);

    // Auto-deploy HEAD
    const deploymentId = await deployHead(args.scriptId);

    const results: string[] = [
      `Updated '${args.fileName}' in project '${project.title}'`,
      `Deployed to HEAD (deployment: ${deploymentId})`,
    ];

    // Sync to GitHub if repo specified
    if (args.githubRepo) {
      try {
        await commitAndPush(
          args.scriptId,
          project.title,
          files,
          args.githubRepo,
          args.commitMessage || `Update ${args.fileName}`
        );
        results.push(`Pushed to GitHub: ${args.githubRepo}`);
      } catch (error) {
        results.push(`GitHub sync failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results.join("\n");
  },
};

export const createFileTool = {
  name: "gas_create_file",
  description: "Create a new file in a Google Apps Script project",
  inputSchema: {
    type: "object" as const,
    properties: {
      scriptId: {
        type: "string",
        description: "The Script ID of the project",
      },
      fileName: {
        type: "string",
        description: "The name of the new file (without extension)",
      },
      fileType: {
        type: "string",
        enum: ["SERVER_JS", "HTML"],
        description: "Type of file: SERVER_JS for .gs files, HTML for .html files",
      },
      source: {
        type: "string",
        description: "The source code for the new file",
      },
    },
    required: ["scriptId", "fileName", "fileType", "source"],
  },
  handler: async (args: {
    scriptId: string;
    fileName: string;
    fileType: "SERVER_JS" | "HTML";
    source: string;
  }): Promise<string> => {
    const { project, files } = await getProjectContent(args.scriptId);

    // Check if file already exists
    if (files.some((f) => f.name === args.fileName)) {
      return `File '${args.fileName}' already exists. Use gas_update_file to modify it.`;
    }

    // Add new file
    files.push({
      name: args.fileName,
      type: args.fileType,
      source: args.source,
    });

    await updateProjectContent(args.scriptId, files);

    // Auto-deploy
    const deploymentId = await deployHead(args.scriptId);

    const ext = args.fileType === "HTML" ? ".html" : ".gs";
    return `Created '${args.fileName}${ext}' in project '${project.title}'\nDeployed to HEAD (deployment: ${deploymentId})`;
  },
};

export const deleteFileTool = {
  name: "gas_delete_file",
  description: "Delete a file from a Google Apps Script project",
  inputSchema: {
    type: "object" as const,
    properties: {
      scriptId: {
        type: "string",
        description: "The Script ID of the project",
      },
      fileName: {
        type: "string",
        description: "The name of the file to delete (without extension)",
      },
    },
    required: ["scriptId", "fileName"],
  },
  handler: async (args: { scriptId: string; fileName: string }): Promise<string> => {
    const { project, files } = await getProjectContent(args.scriptId);

    const fileIndex = files.findIndex((f) => f.name === args.fileName);

    if (fileIndex === -1) {
      return `File '${args.fileName}' not found.`;
    }

    // Prevent deleting appsscript.json
    if (args.fileName === "appsscript") {
      return "Cannot delete 'appsscript.json' - it's required for the project.";
    }

    const deletedFile = files[fileIndex];
    files.splice(fileIndex, 1);

    await updateProjectContent(args.scriptId, files);

    // Auto-deploy
    const deploymentId = await deployHead(args.scriptId);

    return `Deleted '${deletedFile.name}' from project '${project.title}'\nDeployed to HEAD (deployment: ${deploymentId})`;
  },
};
