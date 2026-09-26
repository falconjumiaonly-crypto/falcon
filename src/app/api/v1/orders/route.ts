import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
import { Order, OrderInsert } from "@/types/database";

/**
 * GET /api/v1/orders
 * List orders with pagination and filtering
 */
export async function GET(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return createUnauthorizedResponse();
  }

  try {
    const supabase = await getAutomationSupabaseClient();
    const { searchParams } = new URL(request.url);

    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("orders")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const search = searchParams.get("search");
    if (search?.trim()) {
      const term = search.trim();
      query = query.or(
        `customer_name.ilike.%${term}%,phone_primary.ilike.%${term}%,phone_secondary.ilike.%${term}%,governorate.ilike.%${term}%,address.ilike.%${term}%`
      );
    }

    const printStatus = searchParams.get("print_status");
    if (printStatus && printStatus !== "all") {
      query = query.eq("print_status", printStatus);
    }

    const deliveryStatus = searchParams.get("delivery_status");
    if (deliveryStatus && deliveryStatus !== "all") {
      query = query.eq("delivery_status", deliveryStatus);
    }

    const settlementStatus = searchParams.get("settlement_status");
    if (settlementStatus && settlementStatus !== "all") {
      query = query.eq("settlement_status", settlementStatus);
    }

    const paymentStatus = searchParams.get("payment_status");
    if (paymentStatus && paymentStatus !== "all") {
      query = query.eq("payment_status", paymentStatus);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, error: "فشل استعلام الطلبات: " + error.message },
        { status: 500 }
      );
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages,
      orders: data || [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/v1/orders
 * Create a new shipping order with Idempotency Key support
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return createUnauthorizedResponse();
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  const requestPath = "/api/v1/orders";

  // Check cached idempotent response
  const cachedResponse = await checkIdempotency(idempotencyKey, requestPath);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const body = await request.json();

    const customerName = String(body.customer_name || "").trim();
    const rawPhonePrimary = body.phone_primary;
    const phonePrimary = normalizePhoneNumber(rawPhonePrimary);
    const rawPhoneSecondary = body.phone_secondary;
    const phoneSecondary = rawPhoneSecondary ? normalizePhoneNumber(rawPhoneSecondary) : null;
    const governorate = String(body.governorate || "").trim();
    const address = String(body.address || "").trim();
    const landmark = body.landmark ? String(body.landmark).trim() : null;
    const importantNotes = body.important_notes ? String(body.important_notes).trim() : null;

    const orderTotal = Number(body.order_total);
    const paidAmount = Number(body.paid_amount ?? 0);
    const shippingCost = Number(body.shipping_cost ?? 0);
    const orderDate = body.order_date || new Date().toISOString().split("T")[0];

    // Validation
    const validationErrors: string[] = [];
    if (!customerName) validationErrors.push("اسم العميل (customer_name) مطلوب");
    if (!phonePrimary) validationErrors.push("رقم الهاتف (phone_primary) مطلوب");
    if (!governorate) validationErrors.push("المحافظة (governorate) مطلوبة");
    if (!address) validationErrors.push("العنوان بالتفصيل (address) مطلوب");
    if (isNaN(orderTotal) || orderTotal < 0) {
      validationErrors.push("إجمالي الأوردر (order_total) يجب أن يكون رقماً موجباً أو صفر");
    }
    if (isNaN(paidAmount) || paidAmount < 0) {
      validationErrors.push("المبلغ المدفوع (paid_amount) لا يمكن أن يكون سالباً");
    }
    if (paidAmount > orderTotal) {
      validationErrors.push("المبلغ المدفوع (paid_amount) لا يمكن أن يتجاوز سعر الأوردر");
    }
    if (isNaN(shippingCost) || shippingCost < 0) {
      validationErrors.push("سعر الشحن (shipping_cost) يجب أن يكون قيمة موجبة أو صفر");
    }

    if (validationErrors.length > 0) {
      const errorResp = {
        success: false,
        errors: validationErrors,
      };
      return NextResponse.json(errorResp, { status: 400 });
    }

    const codAmount = calculateCod(orderTotal, paidAmount);
    const netProfit = calculateNetProfit(orderTotal, shippingCost);
    const paymentStatus = derivePaymentStatus(orderTotal, paidAmount);

    const payload: OrderInsert = {
      order_date: orderDate,
      customer_name: customerName,
      phone_primary: phonePrimary,
      phone_secondary: phoneSecondary,
      governorate: governorate,
      address: address,
      landmark: landmark,
      important_notes: importantNotes,
      order_total: orderTotal,
      paid_amount: paidAmount,
      cod_amount: codAmount,
      shipping_cost: shippingCost,
      net_profit: netProfit,
      payment_status: paymentStatus,
      print_status: "pending",
      delivery_status: "new",
      settlement_status: "pending",
    };

    const supabase = await getAutomationSupabaseClient();
    const { data, error } = await supabase
      .from("orders")
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      const dbErrorResp = {
        success: false,
        error: "فشل حفظ الأوردر في قاعدة البيانات: " + error.message,
      };
      return NextResponse.json(dbErrorResp, { status: 500 });
    }

    const createdOrder = data as Order;
    const responsePayload = {
      success: true,
      data: createdOrder,
    };

    // Record response for idempotency
    await recordIdempotency(idempotencyKey, requestPath, 201, responsePayload);

    // Trigger outbound webhook in background
    dispatchWebhookEvent("order.created", createdOrder as any).catch(() => {});

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
