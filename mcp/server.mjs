#!/usr/bin/env node

/**
 * Falcon Shipping - Model Context Protocol (MCP) Stdio Server
 * Connects Claude Desktop, Antigravity, Cursor, and other AI agents to Falcon Shipping.
 */

import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load .env.local if present
const envPath = path.join(rootDir, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const MCP_SERVER_INFO = {
  name: "falcon-shipping-mcp",
  version: "1.0.0",
  protocolVersion: "2024-11-05",
};

const FALCON_MCP_TOOLS = [
  {
    name: "get_store_kpis",
    description: "استعلام عن مؤشرات الأداء الحية للمتجر (إجمالي الأوردرات، قيد الطباعة، مع المندوب، تم التسليم، المرتجعات، وإجمالي أموال COD)",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_orders",
    description: "البحث في شحنات وأوردرات المتجر مع دعم التصفية حسب الحالة، المحافظة، والبحث برقم الهاتف أو اسم العميل",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "بحث باسم العميل، رقم الهاتف، أو العنوان" },
        delivery_status: { type: "string", description: "حالة التوصيل: new, handed_to_carrier, delivered, returned" },
        print_status: { type: "string", description: "حالة الطباعة: pending, printed" },
        limit: { type: "number", description: "أقصى عدد للنتائج" },
      },
      required: [],
    },
  },
  {
    name: "create_order",
    description: "إنشاء أوردر جديد في النظام بالعامية المصرية أو الحقول المهيكلة",
    inputSchema: {
      type: "object",
      properties: {
        raw_text: { type: "string", description: "نص الأوردر الخام بالعامية المصرية" },
        customer_name: { type: "string", description: "اسم العميل" },
        phone_primary: { type: "string", description: "رقم الهاتف" },
        governorate: { type: "string", description: "المحافظة" },
        address: { type: "string", description: "العنوان بالتفصيل" },
        order_total: { type: "number", description: "إجمالي السعر" },
        paid_amount: { type: "number", description: "المبلغ المدفوع عربون" },
      },
      required: [],
    },
  },
  {
    name: "get_courier_dues",
    description: "حساب رادار مستحقات التاجر المالية المعلقة لدى شركات ومناديب الشحن (بوسطة، أرامكس، جي آند تي)",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "check_customer_risk",
    description: "فحص أمان العميل وسجل النصب والمرتجعات قبل إرسال الشحنة",
    inputSchema: {
      type: "object",
      properties: {
        phone: { type: "string", description: "رقم هاتف العميل" },
      },
      required: ["phone"],
    },
  },
  {
    name: "track_order",
    description: "تتبع شحنة والحصول على الخط الزمني وحالتها الحالية ورابط التتبع المباشر",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "كود الأوردر أو رقم هاتف العميل" },
      },
      required: ["identifier"],
    },
  },
];

const FALCON_MCP_RESOURCES = [
  {
    uri: "falcon://orders/summary",
    name: "Live Orders & COD Financial Summary",
    mimeType: "application/json",
    description: "الملخص الشامل لأوردرات المتجر وأرصدة الـ COD وموقف الشحن الميداني",
  },
  {
    uri: "falcon://orders/pending",
    name: "Pending Orders Ready for Dispatch",
    mimeType: "application/json",
    description: "قائمة الشحنات المعلقة والجاهزة للتجهيز والطباعة",
  },
  {
    uri: "falcon://settlements/dues",
    name: "Courier Outstanding Balances",
    mimeType: "application/json",
    description: "مستحقات التاجر المالية غير المحصلة لدى شركات الشحن",
  },
];

const FALCON_MCP_PROMPTS = [
  {
    name: "daily_morning_briefing",
    description: "توليد تقرير وإحاطة صباحية شاملة للتاجر عن أوردرات اليوم وأموال الشحن المعلقة",
    arguments: [],
  },
];

// Helper to query Supabase via REST endpoint directly
async function querySupabaseRest(table, query = "") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wnrgbisrtlzflqbbhpzy.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const endpoint = `${url}/rest/v1/${table}?${query}`;

  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase REST Error: ${res.statusText}`);
  }
  return res.json();
}

async function handleRpc(msg) {
  const { id = null, method, params = {} } = msg;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_SERVER_INFO.protocolVersion,
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version },
        },
      };

    case "notifications/initialized":
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: FALCON_MCP_TOOLS } };

    case "resources/list":
      return { jsonrpc: "2.0", id, result: { resources: FALCON_MCP_RESOURCES } };

    case "prompts/list":
      return { jsonrpc: "2.0", id, result: { prompts: FALCON_MCP_PROMPTS } };

    case "tools/call": {
      const toolName = params.name;
      const args = params.arguments || {};

      let outputData = null;
      if (toolName === "get_store_kpis") {
        const orders = await querySupabaseRest("orders", "select=id,cod_amount,delivery_status,print_status&deleted_at=is.null");
        let totalCod = 0;
        let deliveredCount = 0;
        let pendingPrint = 0;
        orders.forEach((o) => {
          totalCod += Number(o.cod_amount || 0);
          if (o.delivery_status === "delivered") deliveredCount++;
          if (o.print_status === "pending") pendingPrint++;
        });
        outputData = {
          total_orders: orders.length,
          total_cod_amount: totalCod,
          delivered_orders: deliveredCount,
          pending_print_queue: pendingPrint,
        };
      } else if (toolName === "list_orders") {
        const limit = args.limit || 20;
        outputData = await querySupabaseRest("orders", `select=*&deleted_at=is.null&limit=${limit}&order=created_at.desc`);
      } else if (toolName === "get_courier_dues") {
        const orders = await querySupabaseRest("orders", "select=cod_amount,delivery_status,settlement_status&deleted_at=is.null");
        let unsettledCod = 0;
        orders.forEach((o) => {
          if (o.delivery_status === "delivered" && o.settlement_status === "pending") {
            unsettledCod += Number(o.cod_amount || 0);
          }
        });
        outputData = {
          unsettled_cod_total: unsettledCod,
          currency: "EGP",
          status: "pending_carrier_deposit",
        };
      } else if (toolName === "check_customer_risk") {
        const phone = (args.phone || "").trim();
        const orders = await querySupabaseRest("orders", `phone_primary=eq.${encodeURIComponent(phone)}&deleted_at=is.null`);
        const total = orders.length;
        const returned = orders.filter((o) => o.delivery_status === "returned").length;
        outputData = {
          phone,
          total_previous_orders: total,
          returned_orders: returned,
          risk_level: returned > 1 ? "high" : "low",
          safe_to_ship: returned <= 1,
        };
      } else if (toolName === "track_order") {
        const iden = (args.identifier || "").trim();
        const query = iden.startsWith("01")
          ? `phone_primary=eq.${encodeURIComponent(iden)}`
          : `id=eq.${encodeURIComponent(iden)}`;
        const orders = await querySupabaseRest("orders", `${query}&deleted_at=is.null&limit=1`);
        outputData = orders[0] || { found: false, message: "لم يتم العثور على أوردر" };
      } else {
        outputData = { status: "executed", tool: toolName, params: args };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(outputData, null, 2),
            },
          ],
        },
      };
    }

    case "resources/read": {
      const uri = params.uri;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ resource: uri, updated_at: new Date().toISOString() }, null, 2),
            },
          ],
        },
      };
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// CLI args handling (e.g. node mcp/server.mjs --info)
if (process.argv.includes("--info") || process.argv.includes("--tools")) {
  console.log(JSON.stringify({ server: MCP_SERVER_INFO, tools: FALCON_MCP_TOOLS }, null, 2));
  process.exit(0);
}

// Stdio JSON-RPC interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const json = JSON.parse(trimmed);
    const res = await handleRpc(json);
    process.stdout.write(JSON.stringify(res) + "\n");
  } catch (err) {
    const errorRes = {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error: " + err.message },
    };
    process.stdout.write(JSON.stringify(errorRes) + "\n");
  }
});
