import { NextRequest, NextResponse } from "next/server";
import {
  verifyApiKey,
  createUnauthorizedResponse,
  checkIdempotency,
  recordIdempotency,
  getAutomationSupabaseClient,
} from "@/lib/api-auth";
import { Order, PrintStatus } from "@/types/database";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!verifyApiKey(request)) {
    return createUnauthorizedResponse();
  }

  const { id } = await params;
  const idempotencyKey = request.headers.get("idempotency-key");
  const requestPath = `/api/v1/orders/${id}/print-status`;

  const cached = await checkIdempotency(idempotencyKey, requestPath);
  if (cached) return cached;

  try {
    const body = await request.json();
    const status = body.status as PrintStatus;

    if (status !== "pending" && status !== "printed") {
      return NextResponse.json(
        { success: false, error: "حالة الطباعة يجب أن تكون 'pending' أو 'printed'" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      print_status: status,
      printed_at: status === "printed" ? new Date().toISOString() : null,
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

    const responsePayload = {
      success: true,
      data: data as Order,
    };

    await recordIdempotency(idempotencyKey, requestPath, 200, responsePayload);

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
