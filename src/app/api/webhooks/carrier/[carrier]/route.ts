import { NextRequest, NextResponse } from "next/server";
import { processCarrierWebhook } from "@/lib/carriers/webhookProcessor";

interface RouteProps {
  params: Promise<{
    carrier: string;
  }>;
}

/**
 * GET /api/webhooks/carrier/[carrier]
 * Healthcheck & URL validation endpoint for couriers (Bosta, J&T, etc.)
 */
export async function GET(request: NextRequest, props: RouteProps) {
  const { carrier } = await props.params;

  return NextResponse.json({
    status: "ok",
    carrier: carrier.toLowerCase(),
    message: `Falcon Shipping Carrier Webhook Listener for ${carrier} is active and ready`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/webhooks/carrier/[carrier]
 * Ingests live tracking updates from Bosta, J&T, Aramex, or custom couriers
 */
export async function POST(request: NextRequest, props: RouteProps) {
  const { carrier } = await props.params;

  let body: any;
  try {
    const text = await request.text();
    if (!text || text.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Empty request body" },
        { status: 400 }
      );
    }
    body = JSON.parse(text);
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: "Malformed JSON payload" },
      { status: 400 }
    );
  }

  const result = await processCarrierWebhook(carrier, body);

  if (!result.success) {
    // 200 with ignored status prevents courier retry loops if parcel belongs to another store or test
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        orderId: result.orderId,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    orderId: result.orderId,
    matchedBy: result.matchedBy,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
  });
}
