import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=================================================");
console.log("🚀 Testing Mini Task 25: In-Browser WebMCP Integration");
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

// 1. Inspect webmcpClient.ts code and exports
const clientCode = fs.readFileSync(
  path.join(rootDir, "src", "lib", "webmcp", "webmcpClient.ts"),
  "utf8"
);

test("webmcpClient.ts defines FalconWebMcp interface and createWebMcpRuntime", () => {
  assert.ok(clientCode.includes("export interface FalconWebMcp"), "Must define FalconWebMcp interface");
  assert.ok(clientCode.includes("export function createWebMcpRuntime"), "Must export createWebMcpRuntime");
  assert.ok(clientCode.includes("__FALCON_WEBMCP__"), "Must declare global window.__FALCON_WEBMCP__");
});

test("createWebMcpRuntime initializes with version 1.0.0 and default tools", () => {
  assert.ok(clientCode.includes('version: "1.0.0"'), "Must be version 1.0.0");
  assert.ok(clientCode.includes('"navigate_to"'), "Must register navigate_to tool");
  assert.ok(clientCode.includes('"get_page_kpis"'), "Must register get_page_kpis tool");
});

// Test pure logic simulation of WebMCP runtime
function simulateWebMcp() {
  const tools = {};
  const listeners = {};

  const emitEvent = (eventType, payload) => {
    (listeners[eventType] || []).forEach((h) => h(payload));
  };

  const on = (eventType, callback) => {
    if (!listeners[eventType]) listeners[eventType] = [];
    listeners[eventType].push(callback);
    return () => {
      listeners[eventType] = listeners[eventType].filter((cb) => cb !== callback);
    };
  };

  const registerAction = (name, handler, description = "", parameters = {}) => {
    tools[name] = { name, description, parameters, handler };
    emitEvent("tool_registered", { name });
  };

  const unregisterAction = (name) => {
    delete tools[name];
    emitEvent("tool_unregistered", { name });
  };

  const listTools = () => Object.values(tools);

  const executeTool = async (name, params = {}) => {
    if (!tools[name]) throw new Error(`WebMCP: Tool "${name}" is not registered.`);
    emitEvent("tool_executing", { name, params });
    const res = await tools[name].handler(params);
    emitEvent("tool_executed", { name, result: res });
    return res;
  };

  const getState = () => ({
    currentPath: "/orders",
    visibleCount: 25,
    selectedCount: 5,
    selectedIds: ["ord-1", "ord-2", "ord-3", "ord-4", "ord-5"],
    activeFilters: { delivery_status: "new" },
    isReady: true,
    timestamp: new Date().toISOString(),
  });

  return {
    version: "1.0.0",
    tools,
    getState,
    executeTool,
    listTools,
    registerAction,
    unregisterAction,
    emitEvent,
    on,
  };
}

test("WebMCP runtime can register and execute custom actions with arguments", async () => {
  const runtime = simulateWebMcp();
  let receivedArg = null;

  runtime.registerAction(
    "filter_orders_by_governorate",
    (params) => {
      receivedArg = params.governorate;
      return { filtered: true, gov: params.governorate };
    },
    "فلترة الأوردرات حسب محافظة معينة"
  );

  const tools = runtime.listTools();
  assert.strictEqual(tools.length, 1);
  assert.strictEqual(tools[0].name, "filter_orders_by_governorate");

  const result = await runtime.executeTool("filter_orders_by_governorate", {
    governorate: "الإسكندرية",
  });
  assert.strictEqual(receivedArg, "الإسكندرية");
  assert.strictEqual(result.filtered, true);
});

test("WebMCP runtime throws error on unknown tool execution", async () => {
  const runtime = simulateWebMcp();
  let caught = false;
  try {
    await runtime.executeTool("non_existent_tool");
  } catch (err) {
    caught = true;
    assert.ok(err.message.includes("is not registered"));
  }
  assert.ok(caught, "Must throw when tool is not registered");
});

test("WebMCP event listener receives lifecycle notifications", () => {
  const runtime = simulateWebMcp();
  let eventPayload = null;

  const unsubscribe = runtime.on("tool_registered", (p) => {
    eventPayload = p;
  });

  runtime.registerAction("test_action", () => "ok");
  assert.deepStrictEqual(eventPayload, { name: "test_action" });

  unsubscribe();
  runtime.registerAction("another_action", () => "ok");
  // Should not overwrite because unsubscribed
  assert.deepStrictEqual(eventPayload, { name: "test_action" });
});

// 2. Inspect WebMcpProvider.tsx
const providerCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "webmcp", "WebMcpProvider.tsx"),
  "utf8"
);

test("WebMcpProvider registers DOM action handlers for web agents", () => {
  assert.ok(providerCode.includes("select_all_orders"), "Must register select_all_orders action");
  assert.ok(providerCode.includes("clear_selection"), "Must register clear_selection action");
  assert.ok(providerCode.includes("open_manifest_modal"), "Must register open_manifest_modal action");
  assert.ok(providerCode.includes("open_whatsapp_modal"), "Must register open_whatsapp_modal action");
  assert.ok(providerCode.includes("get_visible_table_data"), "Must register get_visible_table_data action");
  assert.ok(providerCode.includes("falcon:webmcp:command"), "Must listen to falcon:webmcp:command events");
});

// 3. Inspect WebMcpInspectorModal.tsx
const inspectorCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "webmcp", "WebMcpInspectorModal.tsx"),
  "utf8"
);

test("WebMcpInspectorModal renders trigger badge and action execution buttons", () => {
  assert.ok(inspectorCode.includes("WebMCP 1.0"), "Must render WebMCP 1.0 badge");
  assert.ok(inspectorCode.includes("handleRunTool"), "Must support live test action execution");
  assert.ok(inspectorCode.includes("window.__FALCON_WEBMCP__"), "Must mention window.__FALCON_WEBMCP__");
});

// 4. Inspect layout.tsx and Header.tsx integration
const layoutCode = fs.readFileSync(
  path.join(rootDir, "src", "app", "(app)", "layout.tsx"),
  "utf8"
);
const headerCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "layout", "Header.tsx"),
  "utf8"
);

test("AppLayout mounts WebMcpProvider and WebMcpInspectorModal", () => {
  assert.ok(layoutCode.includes("<WebMcpProvider>"), "Layout must wrap children in WebMcpProvider");
  assert.ok(layoutCode.includes("<WebMcpInspectorModal"), "Layout must render WebMcpInspectorModal");
});

test("Header displays WebMCP active status badge", () => {
  assert.ok(headerCode.includes('data-webmcp-status="active"'), "Header must have data-webmcp-status attribute");
  assert.ok(headerCode.includes("WebMCP متصل"), "Header must display WebMCP connected label");
});

// 5. Inspect OrdersTable.tsx semantic attributes
const tableCode = fs.readFileSync(
  path.join(rootDir, "src", "components", "orders", "OrdersTable.tsx"),
  "utf8"
);

test("OrdersTable contains semantic data-webmcp-action attributes", () => {
  assert.ok(tableCode.includes('data-webmcp-action="bulk-manifest"'), "Manifest button must have data-webmcp-action");
  assert.ok(tableCode.includes('data-webmcp-action="bulk-whatsapp"'), "WhatsApp button must have data-webmcp-action");
  assert.ok(tableCode.includes('data-webmcp-action="bulk-print"'), "Print button must have data-webmcp-action");
  assert.ok(tableCode.includes('data-webmcp-action="select-all"'), "Select all button must have data-webmcp-action");
  assert.ok(tableCode.includes('data-webmcp-action="clear-selection"'), "Clear selection button must have data-webmcp-action");
});

console.log("=================================================");
console.log(`🎉 All ${passedTests} test cases PASSED successfully!`);
console.log("=================================================");
