import { simpleGit, SimpleGit } from "simple-git";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { GasFile } from "../google-api/apps-script.js";

const WORK_DIR = join(tmpdir(), "mcp-gas-sync");

function ensureWorkDir(): void {
  if (!existsSync(WORK_DIR)) {
    mkdirSync(WORK_DIR, { recursive: true });
  }
}

function getFileExtension(type: string): string {
  switch (type) {
    case "HTML":
      return ".html";
    case "JSON":
      return ".json";
    case "SERVER_JS":
    default:
      return ".gs";
  }
}

export async function commitAndPush(
  scriptId: string,
  projectTitle: string,
  files: GasFile[],
  githubRepo: string,
  commitMessage: string
): Promise<void> {
  ensureWorkDir();

  const repoDir = join(WORK_DIR, scriptId);

  // Clean previous work if exists
  if (existsSync(repoDir)) {
    rmSync(repoDir, { recursive: true });
  }

  mkdirSync(repoDir, { recursive: true });

  const git: SimpleGit = simpleGit(repoDir);

  // Clone or init repo
  const repoUrl = `https://github.com/${githubRepo}.git`;

  try {
    await git.clone(repoUrl, repoDir, ["--depth", "1"]);
  } catch (error) {
    // Repo might not exist or be empty, init new
    await git.init();
    await git.addRemote("origin", repoUrl);
  }

  // Write all files
  for (const file of files) {
    const ext = getFileExtension(file.type);
    const filePath = join(repoDir, `${file.name}${ext}`);
    writeFileSync(filePath, file.source, "utf-8");
  }

  // Add README with project info
  const readme = `# ${projectTitle}

Google Apps Script Project

- **Script ID:** \`${scriptId}\`
- **Synced by:** MCP-Gas

## Files

${files.map((f) => `- ${f.name}${getFileExtension(f.type)}`).join("\n")}
`;
  writeFileSync(join(repoDir, "README.md"), readme, "utf-8");

  // Create .clasp.json for easy clasp integration
  const claspJson = {
    scriptId: scriptId,
    rootDir: ".",
  };
  writeFileSync(
    join(repoDir, ".clasp.json"),
    JSON.stringify(claspJson, null, 2),
    "utf-8"
  );

  // Commit and push
  await git.add(".");

  const status = await git.status();
  if (status.files.length === 0) {
    // No changes to commit
    return;
  }

  await git.commit(commitMessage);
  await git.push("origin", "main", ["--set-upstream"]);
}

export async function pullFromGitHub(
  scriptId: string,
  githubRepo: string
): Promise<GasFile[]> {
  ensureWorkDir();

  const repoDir = join(WORK_DIR, scriptId);

  // Clean previous work
  if (existsSync(repoDir)) {
    rmSync(repoDir, { recursive: true });
  }

  mkdirSync(repoDir, { recursive: true });

  const git: SimpleGit = simpleGit(repoDir);
  const repoUrl = `https://github.com/${githubRepo}.git`;

  await git.clone(repoUrl, repoDir, ["--depth", "1"]);

  // Read files and convert to GasFile format
  const { readdirSync, readFileSync } = await import("fs");
  const entries = readdirSync(repoDir);

  const files: GasFile[] = [];

  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "README.md") continue;

    const ext = entry.split(".").pop();
    let type: GasFile["type"];

    if (ext === "gs" || ext === "js") {
      type = "SERVER_JS";
    } else if (ext === "html") {
      type = "HTML";
    } else if (ext === "json" && entry !== ".clasp.json") {
      type = "JSON";
    } else {
      continue;
    }

    const name = entry.replace(/\.(gs|js|html|json)$/, "");
    const source = readFileSync(join(repoDir, entry), "utf-8");

    files.push({ name, type, source });
  }

  return files;
}
