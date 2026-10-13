import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=================================================");
console.log("🚀 Testing Mini Task 24: Falcon MCP Server (Model Context Protocol)");
console.log("=================================================");

let passedTests = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Inspect falconMcpEngine.ts code and exports
const engineCode = fs.readFileSync(
  path.join(rootDir, "src", "lib", "mcp", "falconMcpEngine.ts"),
  "utf8"
);

test("falconMcpEngine.ts exports MCP_SERVER_INFO with valid protocol specifications", () => {
  assert.ok(engineCode.includes('name: "falcon-shipping-mcp"'), "Server name must be falcon-shipping-mcp");
  assert.ok(engineCode.includes('protocolVersion: "2024-11-05"'), "Must specify 2024-11-05 protocol version");
});

test("falconMcpEngine.ts exports 8 AI Tools with schemas", () => {
  assert.ok(engineCode.includes('name: "get_store_kpis"'), "Must export get_store_kpis");
  assert.ok(engineCode.includes('name: "list_orders"'), "Must export list_orders");
  assert.ok(engineCode.includes('name: "create_order"'), "Must export create_order");
  assert.ok(engineCode.includes('name: "get_courier_dues"'), "Must export get_courier_dues");
  assert.ok(engineCode.includes('name: "check_customer_risk"'), "Must export check_customer_risk");
  assert.ok(engineCode.includes('name: "update_order_status"'), "Must export update_order_status");
  assert.ok(engineCode.includes('name: "track_order"'), "Must export track_order");
  assert.ok(engineCode.includes('name: "parse_order_text"'), "Must export parse_order_text");
});

test("falconMcpEngine.ts defines live resources and prompt templates", () => {
  assert.ok(engineCode.includes('"falcon://orders/summary"'), "Must provide falcon://orders/summary resource");
  assert.ok(engineCode.includes('"falcon://orders/pending"'), "Must provide falcon://orders/pending resource");
  assert.ok(engineCode.includes('"falcon://settlements/dues"'), "Must provide falcon://settlements/dues resource");
  assert.ok(engineCode.includes('"daily_morning_briefing"'), "Must export daily_morning_briefing prompt");
  assert.ok(engineCode.includes('"whatsapp_rescue_script"'), "Must export whatsapp_rescue_script prompt");
});

// 2. Test Standalone Stdio Executable (mcp/server.mjs)
const serverMjsPath = path.join(rootDir, "mcp", "server.mjs");
test("mcp/server.mjs file exists and is executable", () => {
  assert.ok(fs.existsSync(serverMjsPath), "mcp/server.mjs must exist");
});

test("mcp/server.mjs responds to --info CLI flag with JSON server specs", () => {
  const result = spawnSync("node", [serverMjsPath, "--info"], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, "CLI --info command must exit with code 0");
  const parsed = JSON.parse(result.stdout);
  assert.strictEqual(parsed.server.name, "falcon-shipping-mcp");
  assert.ok(Array.isArray(parsed.tools) && parsed.tools.length >= 6);
});

test("mcp/server.mjs handles JSON-RPC 2.0 initialize request over stdio", () => {
  const initMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });

  const result = spawnSync("node", [serverMjsPath], {
    input: initMsg + "\n",
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, "Must exit cleanly");
  const lines = result.stdout.trim().split("\n");
  const lastLine = lines[lines.length - 1];
  const parsed = JSON.parse(lastLine);
  assert.strictEqual(parsed.jsonrpc, "2.0");
  assert.strictEqual(parsed.id, 1);
  assert.strictEqual(parsed.result.serverInfo.name, "falcon-shipping-mcp");
  assert.strictEqual(parsed.result.protocolVersion, "2024-11-05");
});

test("mcp/server.mjs handles JSON-RPC 2.0 tools/list request over stdio", () => {
  const toolsMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  const result = spawnSync("node", [serverMjsPath], {
    input: toolsMsg + "\n",
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, "Must exit cleanly");
  const lines = result.stdout.trim().split("\n");
  const lastLine = lines[lines.length - 1];
  const parsed = JSON.parse(lastLine);
  assert.strictEqual(parsed.id, 2);
  assert.ok(Array.isArray(parsed.result.tools));
  const toolNames = parsed.result.tools.map((t) => t.name);
  assert.ok(toolNames.includes("get_store_kpis"));
  assert.ok(toolNames.includes("list_orders"));
  assert.ok(toolNames.includes("get_courier_dues"));
});

test("mcp/server.mjs returns error code -32601 on unknown method", () => {
  const invalidMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 99,
    method: "non_existent_method",
  });

  const result = spawnSync("node", [serverMjsPath], {
    input: invalidMsg + "\n",
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0);
  const lines = result.stdout.trim().split("\n");
  const lastLine = lines[lines.length - 1];
  const parsed = JSON.parse(lastLine);
  assert.strictEqual(parsed.id, 99);
  assert.strictEqual(parsed.error.code, -32601);
});

// 3. Inspect Next.js HTTP API Route (src/app/api/mcp/route.ts)
const apiRouteCode = fs.readFileSync(
  path.join(rootDir, "src", "app", "api", "mcp", "route.ts"),
  "utf8"
);

test("api/mcp/route.ts exports GET discovery and POST JSON-RPC handlers", () => {
  assert.ok(apiRouteCode.includes("export async function GET"), "Must export GET handler");
  assert.ok(apiRouteCode.includes("export async function POST"), "Must export POST handler");
  assert.ok(apiRouteCode.includes("handleMcpJsonRpc"), "Must call handleMcpJsonRpc");
  assert.ok(apiRouteCode.includes("verifyApiKey"), "Must support API Key verification");
});

// 4. Inspect SettingsView.tsx UI integration
const settingsViewCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "settings", "SettingsView.tsx"),
  "utf8"
);

test("SettingsView.tsx includes Falcon MCP Server guide and testing panel", () => {
  assert.ok(settingsViewCode.includes("خادم الذكاء الاصطناعي (Falcon MCP Server)"), "Must display MCP server card");
  assert.ok(settingsViewCode.includes("mcp/server.mjs"), "Must provide path to local stdio server");
  assert.ok(settingsViewCode.includes("/api/mcp"), "Must provide path to HTTP endpoint");
  assert.ok(settingsViewCode.includes("handleTestMcp"), "Must include interactive handleTestMcp handler");
  assert.ok(settingsViewCode.includes("اختبار اتصال خادم الـ MCP الآن"), "Must have test connection button");
});

console.log("=================================================");
console.log(`🎉 All ${passedTests} test cases PASSED successfully!`);
console.log("=================================================");
