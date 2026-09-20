import { NextRequest, NextResponse } from "next/server";
import {
  verifyApiKey,
  createUnauthorizedResponse,
  checkIdempotency,
  recordIdempotency,
  dispatchWebhookEvent,
  getAutomationSupabaseClient,
} from "@/lib/api-auth";
import { Order, SettlementStatus } from "@/types/database";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!verifyApiKey(request)) {
    return createUnauthorizedResponse();
  }

  const { id } = await params;
  const idempotencyKey = request.headers.get("idempotency-key");
  const requestPath = `/api/v1/orders/${id}/settlement`;

  const cached = await checkIdempotency(idempotencyKey, requestPath);
  if (cached) return cached;

  try {
    const body = await request.json();
    const status = body.status as SettlementStatus;

    if (status !== "pending" && status !== "settled") {
      return NextResponse.json(
        { success: false, error: "حالة التسوية يجب أن تكون 'pending' أو 'settled'" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      settlement_status: status,
      settled_at: status === "settled" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const supabase = await getAutomationSupabaseClient();
    const { data, error } = await (supabase
      .from("orders") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const updatedOrder = data as Order;
    const responsePayload = {
      success: true,
      data: updatedOrder,
    };

    await recordIdempotency(idempotencyKey, requestPath, 200, responsePayload);

    if (status === "settled") {
      dispatchWebhookEvent("order.settled", updatedOrder as any).catch(() => {});
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
