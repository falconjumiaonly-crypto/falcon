import { NextRequest, NextResponse } from "next/server";
import {
  verifyApiKey,
  createUnauthorizedResponse,
  checkIdempotency,
  recordIdempotency,
  dispatchWebhookEvent,
  getAutomationSupabaseClient,
} from "@/lib/api-auth";
import { calculateCod, calculateNetProfit, derivePaymentStatus } from "@/lib/calculations";
import { normalizePhoneNumber } from "@/lib/excel-import";
import { Order } from "@/types/database";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/orders/[id]
 */
export async function GET(request: NextRequest, { params }: Params) {
  if (!verifyApiKey(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const { id } = await params;
    const supabase = await getAutomationSupabaseClient();

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "الأوردر غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: data as Order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/orders/[id]
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!verifyApiKey(request)) {
    return createUnauthorizedResponse();
  }

  const { id } = await params;
  const idempotencyKey = request.headers.get("idempotency-key");
  const requestPath = `/api/v1/orders/${id}`;

  const cached = await checkIdempotency(idempotencyKey, requestPath);
  if (cached) return cached;

  try {
    const supabase = await getAutomationSupabaseClient();

    // 1. Fetch current order
    const { data: existing, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ success: false, error: "الأوردر غير موجود" }, { status: 404 });
    }

    const currentOrder = existing as Order;
    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.customer_name !== undefined) updates.customer_name = String(body.customer_name).trim();
    if (body.phone_primary !== undefined) updates.phone_primary = normalizePhoneNumber(body.phone_primary);
    if (body.phone_secondary !== undefined) {
      updates.phone_secondary = body.phone_secondary ? normalizePhoneNumber(body.phone_secondary) : null;
    }
    if (body.governorate !== undefined) updates.governorate = String(body.governorate).trim();
    if (body.address !== undefined) updates.address = String(body.address).trim();
    if (body.landmark !== undefined) updates.landmark = body.landmark ? String(body.landmark).trim() : null;
    if (body.important_notes !== undefined) {
      updates.important_notes = body.important_notes ? String(body.important_notes).trim() : null;
    }

    if (body.delivery_status !== undefined) updates.delivery_status = body.delivery_status;
    if (body.settlement_status !== undefined) {
      updates.settlement_status = body.settlement_status;
      if (body.settlement_status === "settled") updates.settled_at = new Date().toISOString();
      if (body.settlement_status === "pending") updates.settled_at = null;
    }
    if (body.print_status !== undefined) {
      updates.print_status = body.print_status;
      if (body.print_status === "printed") updates.printed_at = new Date().toISOString();
      if (body.print_status === "pending") updates.printed_at = null;
    }

    // Financial updates & recalculations
    const newTotal = body.order_total !== undefined ? Number(body.order_total) : currentOrder.order_total;
    const newPaid = body.paid_amount !== undefined ? Number(body.paid_amount) : currentOrder.paid_amount;
    const newShipping = body.shipping_cost !== undefined ? Number(body.shipping_cost) : currentOrder.shipping_cost;

    if (body.order_total !== undefined) updates.order_total = newTotal;
    if (body.paid_amount !== undefined) updates.paid_amount = newPaid;
    if (body.shipping_cost !== undefined) updates.shipping_cost = newShipping;

    if (body.order_total !== undefined || body.paid_amount !== undefined) {
      if (newPaid > newTotal) {
        return NextResponse.json(
          { success: false, error: "المبلغ المدفوع لا يمكن أن يتجاوز سعر الأوردر" },
          { status: 400 }
        );
      }
      updates.cod_amount = calculateCod(newTotal, newPaid);
      updates.payment_status = derivePaymentStatus(newTotal, newPaid);
    }

    if (body.order_total !== undefined || body.shipping_cost !== undefined) {
      updates.net_profit = calculateNetProfit(newTotal, newShipping);
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateErr } = await (supabase
      .from("orders") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    const updatedOrder = updated as Order;
    const responsePayload = {
      success: true,
      data: updatedOrder,
    };

    await recordIdempotency(idempotencyKey, requestPath, 200, responsePayload);

    // Webhook event
    dispatchWebhookEvent("order.updated", updatedOrder as any).catch(() => {});

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
