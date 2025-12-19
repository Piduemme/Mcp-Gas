#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import tools
import { listProjectsTool, getProjectTool } from "./tools/projects.js";
import {
  readFileTool,
  readAllFilesTool,
  updateFileTool,
  createFileTool,
  deleteFileTool,
} from "./tools/code.js";
import { listFunctionsTool, runFunctionTool } from "./tools/execute.js";
import { getLogsTool } from "./tools/logs.js";
import { listDeploymentsTool, deployTool } from "./tools/deploy.js";

// All available tools
const tools = [
  listProjectsTool,
  getProjectTool,
  readFileTool,
  readAllFilesTool,
  updateFileTool,
  createFileTool,
  deleteFileTool,
  listFunctionsTool,
  runFunctionTool,
  getLogsTool,
  listDeploymentsTool,
  deployTool,
];

// Create MCP server
const server = new Server(
  {
    name: "mcp-gas",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = tools.find((t) => t.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.handler(args as any);
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP-Gas server started");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
