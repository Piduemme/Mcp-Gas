import { listFunctions, runFunction } from "../google-api/apps-script.js";

export const listFunctionsTool = {
  name: "gas_list_functions",
  description: "List all functions available in a Google Apps Script project",
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
    const functions = await listFunctions(args.scriptId);

    if (functions.length === 0) {
      return "No functions found in this project.";
    }

    return `**Functions (${functions.length}):**\n${functions.map((f) => `- ${f}()`).join("\n")}`;
  },
};

export const runFunctionTool = {
  name: "gas_run_function",
  description:
    "Execute a function in a Google Apps Script project (without parameters). " +
    "The script must be deployed and have the Apps Script API enabled.",
  inputSchema: {
    type: "object" as const,
    properties: {
      scriptId: {
        type: "string",
        description: "The Script ID of the project",
      },
      functionName: {
        type: "string",
        description: "The name of the function to execute",
      },
    },
    required: ["scriptId", "functionName"],
  },
  handler: async (args: { scriptId: string; functionName: string }): Promise<string> => {
    const result = await runFunction(args.scriptId, args.functionName);

    if (result.success) {
      const resultStr = result.result !== undefined
        ? `\n**Return value:** ${JSON.stringify(result.result, null, 2)}`
        : "\n(Function returned no value)";
      return `**Executed ${args.functionName}() successfully**${resultStr}`;
    } else {
      return `**Execution failed**\n**Error:** ${result.error}`;
    }
  },
};
