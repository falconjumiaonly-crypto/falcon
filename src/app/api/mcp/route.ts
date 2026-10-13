import { NextRequest, NextResponse } from "next/server";
import {
  handleMcpJsonRpc,
  FALCON_MCP_TOOLS,
  FALCON_MCP_RESOURCES,
  FALCON_MCP_PROMPTS,
  MCP_SERVER_INFO,
} from "@/lib/mcp/falconMcpEngine";
import { verifyApiKey } from "@/lib/api-auth";

/**
 * GET /api/mcp
 * Returns MCP Server discovery, tools catalog, and client connection configuration
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const serverEndpoint = `${protocol}://${host}/api/mcp`;

  return NextResponse.json({
    status: "online",
    server: MCP_SERVER_INFO,
    endpoint: serverEndpoint,
    tools_count: FALCON_MCP_TOOLS.length,
    tools: FALCON_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
    resources: FALCON_MCP_RESOURCES,
    prompts: FALCON_MCP_PROMPTS,
    client_config_example: {
      mcpServers: {
        "falcon-shipping": {
          url: serverEndpoint,
          headers: {
            Authorization: "Bearer falcon_sec_live_9f83a02bb4e1423c91a78e2d4099ce",
          },
        },
      },
    },
  });
}

/**
 * POST /api/mcp
 * MCP JSON-RPC 2.0 Transport Endpoint
 */
export async function POST(request: NextRequest) {
  // Allow optional authentication check; if authorization is supplied, verify it
  const authHeader = request.headers.get("authorization");
  if (authHeader && !verifyApiKey(request)) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "Unauthorized: Invalid API Key" },
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error: Invalid JSON object" },
        },
        { status: 400 }
      );
    }

    const response = await handleMcpJsonRpc(body);
    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: err.message || "Internal server error" },
      },
      { status: 500 }
    );
  }
}
