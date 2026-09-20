import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wnrgbisrtlzflqbbhpzy.supabase.co";
const SERVICE_OR_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const EXPECTED_API_KEY = process.env.AUTOMATION_API_KEY || "falcon_sec_live_9f83a02bb4e1423c91a78e2d4099ce";

/**
 * Validates incoming Bearer token or X-API-Key against AUTOMATION_API_KEY
 */
export function verifyApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization") || "";
  const apiKeyHeader = request.headers.get("x-api-key") || "";

  let providedKey = "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    providedKey = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    providedKey = apiKeyHeader.trim();
  }

  return providedKey === EXPECTED_API_KEY;
}

export function createUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "غير مصرح لك بالوصول. مفتاح API غير صالح أو مفقود (Authorization: Bearer <API_KEY>)",
    },
    { status: 401 }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedAuthClient: any = null;
let tokenExpiresAt = 0;

/**
 * Returns an authenticated Supabase client for backend automation operations
 */
export async function getAutomationSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(SUPABASE_URL, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const now = Date.now();
  if (cachedAuthClient && now < tokenExpiresAt) {
    return cachedAuthClient;
  }

  const client = createClient(SUPABASE_URL, SERVICE_OR_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: "admin@falcon.com",
    password: "FalconAdmin2026!",
  });

  if (error || !data.session) {
    console.error("Automation Supabase sign-in failed:", error?.message);
    return client;
  }

  tokenExpiresAt = now + (data.session.expires_in - 60) * 1000;
  cachedAuthClient = client;
  return client;
}

/**
 * Checks if an Idempotency-Key has already been processed for this exact endpoint.
 */
export async function checkIdempotency(
  idempotencyKey: string | null,
  requestPath: string
): Promise<NextResponse | null> {
  if (!idempotencyKey || !idempotencyKey.trim()) return null;

  try {
    const supabase = await getAutomationSupabaseClient();
    const { data, error } = await supabase
      .from("api_idempotency_keys")
      .select("response_status, response_body")
      .eq("idempotency_key", idempotencyKey.trim())
      .eq("request_path", requestPath)
      .maybeSingle();

    if (error || !data) return null;

    return NextResponse.json(data.response_body, {
      status: data.response_status,
      headers: {
        "X-Cache-Lookup": "HIT",
        "X-Idempotent-Replay": "true",
      },
    });
  } catch {
    return null;
  }
}

/**
 * Saves the response status and body for the given Idempotency-Key.
 */
export async function recordIdempotency(
  idempotencyKey: string | null,
  requestPath: string,
  status: number,
  body: unknown
): Promise<void> {
  if (!idempotencyKey || !idempotencyKey.trim()) return;

  try {
    const supabase = await getAutomationSupabaseClient();
    await supabase.from("api_idempotency_keys").insert({
      idempotency_key: idempotencyKey.trim(),
      request_path: requestPath,
      response_status: status,
      response_body: body as any,
    });
  } catch (err) {
    console.error("Failed to record idempotency key:", err);
  }
}

/**
 * Optional Outbound Webhook Dispatcher
 */
export async function dispatchWebhookEvent(
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await getAutomationSupabaseClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "webhook_config")
      .maybeSingle();

    const webhookUrl = (data?.value as any)?.url;
    if (!webhookUrl || typeof webhookUrl !== "string" || !webhookUrl.startsWith("http")) {
      return;
    }

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // Non-blocking log
    console.warn("Webhook dispatch error:", err);
  }
}
