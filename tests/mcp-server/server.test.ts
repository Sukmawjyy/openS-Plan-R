/**
 * tests/mcp-server/server.test.ts
 * Tests for MCP server creation and tool registration.
 * Verifies: TOOL_DEFINITIONS list, handler dispatch via CallToolRequestSchema,
 * unknown-tool fallback, and ListToolsRequestSchema.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoist mock factories so they're available before vi.mock hoisting ────────
const { mockSetRequestHandler, mockConnect, MockServer, MockTransport } = vi.hoisted(() => {
  const mockSetRequestHandler = vi.fn();
  const mockConnect = vi.fn();

  // Must use mockImplementation with a regular function body so `new Server(...)` works
  const MockServerFn = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.setRequestHandler = mockSetRequestHandler;
    this.connect = mockConnect;
  });

  // StdioServerTransport also needs to be a proper constructor
  const MockTransportFn = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.__isTransport = true;
  });

  return { mockSetRequestHandler, mockConnect, MockServer: MockServerFn, MockTransport: MockTransportFn };
});

// ─── Mock MCP SDK ─────────────────────────────────────────────────────────────

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: MockServer,
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: MockTransport,
}));

// Keep real schema values but wrapped in symbols for identity tests
vi.mock("@modelcontextprotocol/sdk/types.js", async () => {
  // Use stable objects (not symbols) so we can match them
  const ListToolsRequestSchema = { __schema: "ListTools" } as const;
  const CallToolRequestSchema = { __schema: "CallTool" } as const;
  return { ListToolsRequestSchema, CallToolRequestSchema };
});

// ─── Mock all tool handlers ───────────────────────────────────────────────────

vi.mock("../../src/mcp-server/tools.js", () => ({
  handleInstall: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "install ok" }] }),
  handleRemove:  vi.fn().mockResolvedValue({ content: [{ type: "text", text: "remove ok" }] }),
  handleList:    vi.fn().mockResolvedValue({ content: [{ type: "text", text: "list ok" }] }),
  handleSearch:  vi.fn().mockResolvedValue({ content: [{ type: "text", text: "search ok" }] }),
  handleAudit:   vi.fn().mockResolvedValue({ content: [{ type: "text", text: "audit ok" }] }),
  handleDoctor:  vi.fn().mockResolvedValue({ content: [{ type: "text", text: "doctor ok" }] }),
  handleInfo:    vi.fn().mockResolvedValue({ content: [{ type: "text", text: "info ok" }] }),
  handleStatus:  vi.fn().mockResolvedValue({ content: [{ type: "text", text: "status ok" }] }),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { startMcpServer } from "../../src/mcp-server/server.js";
import {
  handleInstall, handleRemove, handleList, handleSearch,
  handleAudit, handleDoctor, handleInfo, handleStatus,
} from "../../src/mcp-server/tools.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Handler = (req: unknown) => Promise<unknown>;

/**
 * Start server and capture the handler registered for a given schema.
 */
async function getRegisteredHandlers(): Promise<Map<unknown, Handler>> {
  mockSetRequestHandler.mockReset();
  mockConnect.mockResolvedValue(undefined);
  await startMcpServer();
  const map = new Map<unknown, Handler>();
  for (const [schema, handler] of mockSetRequestHandler.mock.calls) {
    map.set(schema, handler as Handler);
  }
  return map;
}

// ─── Server creation ─────────────────────────────────────────────────────────

describe("startMcpServer()", () => {
  beforeEach(() => {
    mockSetRequestHandler.mockReset();
    mockConnect.mockClear();
    mockConnect.mockResolvedValue(undefined);
    MockServer.mockClear();
    MockTransport.mockClear();
  });

  it("instantiates Server with name 'mcpman'", async () => {
    await startMcpServer();
    expect(MockServer).toHaveBeenCalledWith(
      expect.objectContaining({ name: "mcpman" }),
      expect.any(Object),
    );
  });

  it("instantiates Server with version from APP_VERSION", async () => {
    await startMcpServer();
    const initArg = (MockServer.mock.calls[0][0] as { version: string });
    expect(typeof initArg.version).toBe("string");
    expect(initArg.version.length).toBeGreaterThan(0);
  });

  it("configures tools capability", async () => {
    await startMcpServer();
    expect(MockServer).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ capabilities: { tools: {} } }),
    );
  });

  it("registers exactly 2 request handlers (list + call)", async () => {
    await startMcpServer();
    expect(mockSetRequestHandler).toHaveBeenCalledTimes(2);
  });

  it("registers a handler for ListToolsRequestSchema", async () => {
    await startMcpServer();
    const schemas = mockSetRequestHandler.mock.calls.map(([s]) => s);
    expect(schemas).toContain(ListToolsRequestSchema);
  });

  it("registers a handler for CallToolRequestSchema", async () => {
    await startMcpServer();
    const schemas = mockSetRequestHandler.mock.calls.map(([s]) => s);
    expect(schemas).toContain(CallToolRequestSchema);
  });

  it("connects server to a StdioServerTransport", async () => {
    await startMcpServer();
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });
});

// ─── ListToolsRequestSchema handler ──────────────────────────────────────────

describe("ListTools handler", () => {
  const EXPECTED_TOOLS = [
    "mcpman_install",
    "mcpman_remove",
    "mcpman_list",
    "mcpman_search",
    "mcpman_audit",
    "mcpman_doctor",
    "mcpman_info",
    "mcpman_status",
  ];

  async function listTools() {
    const handlers = await getRegisteredHandlers();
    const handler = handlers.get(ListToolsRequestSchema);
    if (!handler) throw new Error("ListTools handler not found");
    return (await handler({})) as { tools: Array<Record<string, unknown>> };
  }

  it("returns exactly 8 tools", async () => {
    const result = await listTools();
    expect(result.tools).toHaveLength(8);
  });

  it("returns all expected tool names", async () => {
    const result = await listTools();
    const names = result.tools.map((t) => t.name);
    for (const expected of EXPECTED_TOOLS) {
      expect(names).toContain(expected);
    }
  });

  it("each tool has a non-empty description", async () => {
    const result = await listTools();
    for (const tool of result.tools) {
      expect(typeof tool.description).toBe("string");
      expect((tool.description as string).length).toBeGreaterThan(0);
    }
  });

  it("each tool has an inputSchema with type='object'", async () => {
    const result = await listTools();
    for (const tool of result.tools) {
      const schema = tool.inputSchema as Record<string, unknown>;
      expect(schema).toBeDefined();
      expect(schema.type).toBe("object");
    }
  });

  it("mcpman_install schema requires 'name'", async () => {
    const result = await listTools();
    const install = result.tools.find((t) => t.name === "mcpman_install");
    const schema = install?.inputSchema as { required: string[] };
    expect(schema.required).toContain("name");
  });

  it("mcpman_remove schema requires 'name'", async () => {
    const result = await listTools();
    const remove = result.tools.find((t) => t.name === "mcpman_remove");
    const schema = remove?.inputSchema as { required: string[] };
    expect(schema.required).toContain("name");
  });

  it("mcpman_search schema requires 'query'", async () => {
    const result = await listTools();
    const search = result.tools.find((t) => t.name === "mcpman_search");
    const schema = search?.inputSchema as { required: string[] };
    expect(schema.required).toContain("query");
  });

  it("mcpman_info schema requires 'name'", async () => {
    const result = await listTools();
    const info = result.tools.find((t) => t.name === "mcpman_info");
    const schema = info?.inputSchema as { required: string[] };
    expect(schema.required).toContain("name");
  });

  it("mcpman_status schema has empty required array", async () => {
    const result = await listTools();
    const status = result.tools.find((t) => t.name === "mcpman_status");
    const schema = status?.inputSchema as { required: string[] };
    expect(schema.required).toHaveLength(0);
  });

  it("mcpman_list schema has optional client property", async () => {
    const result = await listTools();
    const list = result.tools.find((t) => t.name === "mcpman_list");
    const schema = list?.inputSchema as { properties: Record<string, unknown>; required: string[] };
    expect(schema.properties).toHaveProperty("client");
    expect(schema.required).toHaveLength(0);
  });

  it("mcpman_audit schema has optional server property", async () => {
    const result = await listTools();
    const audit = result.tools.find((t) => t.name === "mcpman_audit");
    const schema = audit?.inputSchema as { properties: Record<string, unknown> };
    expect(schema.properties).toHaveProperty("server");
  });
});

// ─── CallToolRequestSchema handler dispatch ───────────────────────────────────

describe("CallTool dispatch", () => {
  type MockedFn = ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (handleInstall as MockedFn).mockResolvedValue({ content: [{ type: "text", text: "install ok" }] });
    (handleRemove  as MockedFn).mockResolvedValue({ content: [{ type: "text", text: "remove ok" }] });
    (handleList    as MockedFn).mockResolvedValue({ content: [{ type: "text", text: "list ok" }] });
    (handleSearch  as MockedFn).mockResolvedValue({ content: [{ type: "text", text: "search ok" }] });
    (handleAudit   as MockedFn).mockResolvedValue({ content: [{ type: "text", text: "audit ok" }] });
    (handleDoctor  as MockedFn).mockResolvedValue({ content: [{ type: "text", text: "doctor ok" }] });
    (handleInfo    as MockedFn).mockResolvedValue({ content: [{ type: "text", text: "info ok" }] });
    (handleStatus  as MockedFn).mockResolvedValue({ content: [{ type: "text", text: "status ok" }] });
  });

  async function callTool(name: string, args: Record<string, unknown> = {}) {
    const handlers = await getRegisteredHandlers();
    const handler = handlers.get(CallToolRequestSchema);
    if (!handler) throw new Error("CallTool handler not found");
    return handler({ params: { name, arguments: args } });
  }

  it("routes mcpman_install to handleInstall", async () => {
    await callTool("mcpman_install", { name: "test-pkg" });
    expect(handleInstall).toHaveBeenCalledWith({ name: "test-pkg" });
  });

  it("routes mcpman_remove to handleRemove", async () => {
    await callTool("mcpman_remove", { name: "test-pkg" });
    expect(handleRemove).toHaveBeenCalledWith({ name: "test-pkg" });
  });

  it("routes mcpman_list to handleList", async () => {
    await callTool("mcpman_list", { client: "cursor" });
    expect(handleList).toHaveBeenCalledWith({ client: "cursor" });
  });

  it("routes mcpman_search to handleSearch", async () => {
    await callTool("mcpman_search", { query: "browser" });
    expect(handleSearch).toHaveBeenCalledWith({ query: "browser" });
  });

  it("routes mcpman_audit to handleAudit", async () => {
    await callTool("mcpman_audit", { server: "my-server" });
    expect(handleAudit).toHaveBeenCalledWith({ server: "my-server" });
  });

  it("routes mcpman_doctor to handleDoctor", async () => {
    await callTool("mcpman_doctor", {});
    expect(handleDoctor).toHaveBeenCalledWith({});
  });

  it("routes mcpman_info to handleInfo", async () => {
    await callTool("mcpman_info", { name: "my-server" });
    expect(handleInfo).toHaveBeenCalledWith({ name: "my-server" });
  });

  it("routes mcpman_status to handleStatus", async () => {
    await callTool("mcpman_status", {});
    expect(handleStatus).toHaveBeenCalledWith({});
  });

  it("returns isError=true for unknown tool name", async () => {
    const result = (await callTool("mcpman_unknown_xyz")) as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool");
    expect(result.content[0].text).toContain("mcpman_unknown_xyz");
  });

  it("passes empty object as args when arguments field is undefined", async () => {
    const handlers = await getRegisteredHandlers();
    const handler = handlers.get(CallToolRequestSchema);
    if (!handler) throw new Error("CallTool handler not found");
    await handler({ params: { name: "mcpman_status" } });
    expect(handleStatus).toHaveBeenCalledWith({});
  });

  it("returns result content array from handler", async () => {
    const result = (await callTool("mcpman_install", { name: "test-pkg" })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toBe("install ok");
  });
});

// ─── Schema definitions (types.ts) ───────────────────────────────────────────

describe("types.ts JSON schemas", () => {
  it("installSchema has required=['name'] and optional client/url", async () => {
    const { installSchema } = await import("../../src/mcp-server/types.js");
    expect(installSchema.required).toEqual(["name"]);
    expect(installSchema.properties).toHaveProperty("name");
    expect(installSchema.properties).toHaveProperty("client");
    expect(installSchema.properties).toHaveProperty("url");
  });

  it("removeSchema has required=['name']", async () => {
    const { removeSchema } = await import("../../src/mcp-server/types.js");
    expect(removeSchema.required).toEqual(["name"]);
  });

  it("searchSchema has required=['query'] and optional limit", async () => {
    const { searchSchema } = await import("../../src/mcp-server/types.js");
    expect(searchSchema.required).toEqual(["query"]);
    expect(searchSchema.properties).toHaveProperty("limit");
  });

  it("listSchema has empty required array and optional client", async () => {
    const { listSchema } = await import("../../src/mcp-server/types.js");
    expect(listSchema.required).toHaveLength(0);
    expect(listSchema.properties).toHaveProperty("client");
  });

  it("auditSchema has empty required array with optional server", async () => {
    const { auditSchema } = await import("../../src/mcp-server/types.js");
    expect(auditSchema.required).toHaveLength(0);
    expect(auditSchema.properties).toHaveProperty("server");
  });

  it("doctorSchema has empty required array with optional server", async () => {
    const { doctorSchema } = await import("../../src/mcp-server/types.js");
    expect(doctorSchema.required).toHaveLength(0);
    expect(doctorSchema.properties).toHaveProperty("server");
  });

  it("infoSchema has required=['name']", async () => {
    const { infoSchema } = await import("../../src/mcp-server/types.js");
    expect(infoSchema.required).toEqual(["name"]);
  });

  it("statusSchema has empty required array and empty properties", async () => {
    const { statusSchema } = await import("../../src/mcp-server/types.js");
    expect(statusSchema.required).toHaveLength(0);
    expect(Object.keys(statusSchema.properties)).toHaveLength(0);
  });

  it("all schemas have type='object'", async () => {
    const {
      installSchema, removeSchema, listSchema, searchSchema,
      auditSchema, doctorSchema, infoSchema, statusSchema,
    } = await import("../../src/mcp-server/types.js");
    const schemas = [installSchema, removeSchema, listSchema, searchSchema, auditSchema, doctorSchema, infoSchema, statusSchema];
    for (const schema of schemas) {
      expect(schema.type).toBe("object");
    }
  });
});
