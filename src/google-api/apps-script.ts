import { getAppsScriptService, getDriveService } from "../auth/clasp-auth.js";
import type { script_v1 } from "googleapis";

export interface GasProject {
  scriptId: string;
  title: string;
  createTime?: string;
  updateTime?: string;
  parentId?: string;
}

export interface GasFile {
  name: string;
  type: "SERVER_JS" | "HTML" | "JSON";
  source: string;
  functionSet?: {
    values: Array<{ name: string }>;
  };
}

export interface ExecutionLog {
  processId: string;
  functionName: string;
  startTime: string;
  duration: string;
  status: string;
  error?: string;
}

// List all Apps Script projects
export async function listProjects(): Promise<GasProject[]> {
  const drive = getDriveService();

  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.script'",
    fields: "files(id, name, createdTime, modifiedTime, parents)",
    pageSize: 100,
    orderBy: "modifiedTime desc",
  });

  return (response.data.files || []).map((file) => ({
    scriptId: file.id!,
    title: file.name!,
    createTime: file.createdTime || undefined,
    updateTime: file.modifiedTime || undefined,
    parentId: file.parents?.[0] || undefined,
  }));
}

// Get project content (all files)
export async function getProjectContent(scriptId: string): Promise<{
  project: GasProject;
  files: GasFile[];
}> {
  const script = getAppsScriptService();

  const response = await script.projects.getContent({
    scriptId,
  });

  const metadata = await script.projects.get({
    scriptId,
  });

  const files: GasFile[] = (response.data.files || []).map((file) => ({
    name: file.name!,
    type: file.type as GasFile["type"],
    source: file.source || "",
    functionSet: file.functionSet as GasFile["functionSet"],
  }));

  return {
    project: {
      scriptId,
      title: metadata.data.title || "Untitled",
      createTime: metadata.data.createTime || undefined,
      updateTime: metadata.data.updateTime || undefined,
      parentId: metadata.data.parentId || undefined,
    },
    files,
  };
}

// Update project content
export async function updateProjectContent(
  scriptId: string,
  files: GasFile[]
): Promise<void> {
  const script = getAppsScriptService();

  await script.projects.updateContent({
    scriptId,
    requestBody: {
      files: files.map((f) => ({
        name: f.name,
        type: f.type,
        source: f.source,
      })),
    },
  });
}

// List functions in a project
export async function listFunctions(scriptId: string): Promise<string[]> {
  const { files } = await getProjectContent(scriptId);

  const functions: string[] = [];

  for (const file of files) {
    if (file.type === "SERVER_JS" && file.functionSet?.values) {
      for (const func of file.functionSet.values) {
        functions.push(func.name);
      }
    }
  }

  // Also parse source for functions (functionSet may not be complete)
  for (const file of files) {
    if (file.type === "SERVER_JS") {
      const funcRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
      let match;
      while ((match = funcRegex.exec(file.source)) !== null) {
        if (!functions.includes(match[1])) {
          functions.push(match[1]);
        }
      }
    }
  }

  return functions.sort();
}

// Run a function (no parameters)
export async function runFunction(
  scriptId: string,
  functionName: string
): Promise<{
  success: boolean;
  result?: unknown;
  error?: string;
}> {
  const script = getAppsScriptService();

  try {
    const response = await script.scripts.run({
      scriptId,
      requestBody: {
        function: functionName,
        parameters: [],
        devMode: true, // Use HEAD deployment
      },
    });

    if (response.data.error) {
      return {
        success: false,
        error: response.data.error.message || JSON.stringify(response.data.error),
      };
    }

    return {
      success: true,
      result: response.data.response?.result,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

// Get execution logs
export async function getExecutionLogs(
  scriptId: string,
  limit: number = 20
): Promise<ExecutionLog[]> {
  const script = getAppsScriptService();

  const response = await script.processes.list({
    "userProcessFilter.scriptId": scriptId,
    pageSize: limit,
  });

  const processes = response.data.processes || [];
  return processes.map((process: script_v1.Schema$GoogleAppsScriptTypeProcess) => ({
    processId: process.processId || "",
    functionName: process.functionName || "unknown",
    startTime: process.startTime || "",
    duration: process.duration || "0s",
    status: process.processStatus || "UNKNOWN",
    error: process.error?.message,
  }));
}

// Create a new version
export async function createVersion(
  scriptId: string,
  description: string
): Promise<number> {
  const script = getAppsScriptService();

  const response = await script.projects.versions.create({
    scriptId,
    requestBody: {
      description,
    },
  });

  return response.data.versionNumber || 0;
}

// List deployments
export async function listDeployments(
  scriptId: string
): Promise<Array<{
  deploymentId: string;
  versionNumber?: number;
  description?: string;
  updateTime?: string;
}>> {
  const script = getAppsScriptService();

  const response = await script.projects.deployments.list({
    scriptId,
  });

  return (response.data.deployments || []).map((d) => ({
    deploymentId: d.deploymentId || "",
    versionNumber: d.deploymentConfig?.versionNumber || undefined,
    description: d.deploymentConfig?.description || undefined,
    updateTime: d.updateTime || undefined,
  }));
}

// Create HEAD deployment (or update existing)
export async function deployHead(scriptId: string): Promise<string> {
  const script = getAppsScriptService();

  // Check if HEAD deployment exists
  const deployments = await listDeployments(scriptId);
  const headDeployment = deployments.find(
    (d) => d.description === "@HEAD" || d.versionNumber === undefined
  );

  if (headDeployment) {
    // Update existing HEAD deployment
    await script.projects.deployments.update({
      scriptId,
      deploymentId: headDeployment.deploymentId,
      requestBody: {
        deploymentConfig: {
          description: "@HEAD",
        },
      },
    });
    return headDeployment.deploymentId;
  }

  // Create new HEAD deployment
  const response = await script.projects.deployments.create({
    scriptId,
    requestBody: {
      versionNumber: 0, // 0 means HEAD
      description: "@HEAD",
    },
  });

  return response.data.deploymentId || "";
}
