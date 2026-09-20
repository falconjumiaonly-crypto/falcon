import { NextRequest, NextResponse } from "next/server";
import {
  verifyApiKey,
  createUnauthorizedResponse,
  checkIdempotency,
  recordIdempotency,
  getAutomationSupabaseClient,
} from "@/lib/api-auth";
import { calculateCod, calculateNetProfit, derivePaymentStatus } from "@/lib/calculations";
import { normalizePhoneNumber } from "@/lib/excel-import";
import { Order, OrderInsert } from "@/types/database";

/**
 * POST /api/v1/orders/bulk
 * Bulk order ingestion with idempotency
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return createUnauthorizedResponse();
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  const requestPath = "/api/v1/orders/bulk";

  const cached = await checkIdempotency(idempotencyKey, requestPath);
  if (cached) return cached;

  try {
    const body = await request.json();
    const rawList = Array.isArray(body) ? body : body.orders;

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json(
        { success: false, error: "مصفوفة الأوردرات فارغة أو غير صالحة (orders: [])" },
        { status: 400 }
      );
    }

    const cleanPayloads: OrderInsert[] = [];
    const errors: { index: number; errors: string[] }[] = [];

    rawList.forEach((item, index) => {
      const customerName = String(item.customer_name || "").trim();
      const phonePrimary = normalizePhoneNumber(item.phone_primary);
      const phoneSecondary = item.phone_secondary ? normalizePhoneNumber(item.phone_secondary) : null;
      const governorate = String(item.governorate || "").trim();
      const address = String(item.address || "").trim();

      const orderTotal = Number(item.order_total);
      const paidAmount = Number(item.paid_amount ?? 0);
      const shippingCost = Number(item.shipping_cost ?? 0);
      const orderDate = item.order_date || new Date().toISOString().split("T")[0];

      const itemErrors: string[] = [];
      if (!customerName) itemErrors.push("اسم العميل مطلوب");
      if (!phonePrimary) itemErrors.push("رقم الهاتف الأساسي مطلوب");
      if (!governorate) itemErrors.push("المحافظة مطلوبة");
      if (!address) itemErrors.push("العنوان مطلوب");
      if (isNaN(orderTotal) || orderTotal < 0) itemErrors.push("سعر الأوردر غير صالح");
      if (isNaN(paidAmount) || paidAmount < 0) itemErrors.push("المبلغ المدفوع غير صالح");
      if (paidAmount > orderTotal) itemErrors.push("المدفوع يتجاوز الإجمالي");

      if (itemErrors.length > 0) {
        errors.push({ index, errors: itemErrors });
      } else {
        const codAmount = calculateCod(orderTotal, paidAmount);
        const netProfit = calculateNetProfit(orderTotal, shippingCost);
        const paymentStatus = derivePaymentStatus(orderTotal, paidAmount);

        cleanPayloads.push({
          order_date: orderDate,
          customer_name: customerName,
          phone_primary: phonePrimary,
          phone_secondary: phoneSecondary,
          governorate: governorate,
          address: address,
          landmark: item.landmark ? String(item.landmark).trim() : null,
          important_notes: item.important_notes ? String(item.important_notes).trim() : null,
          order_total: orderTotal,
          paid_amount: paidAmount,
          cod_amount: codAmount,
          shipping_cost: shippingCost,
          net_profit: netProfit,
          payment_status: paymentStatus,
          print_status: "pending",
          delivery_status: "new",
          settlement_status: "pending",
        });
      }
    });

    if (errors.length > 0 && cleanPayloads.length === 0) {
      return NextResponse.json(
        { success: false, message: "فشل إدراج أي أوردر لوجود أخطاء بالبيانات", errors },
        { status: 400 }
      );
    }

    const supabase = await getAutomationSupabaseClient();
    const { data: inserted, error: insertError } = await supabase
      .from("orders")
      .insert(cleanPayloads as any)
      .select();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: "فشل الإدراج الجماعي: " + insertError.message },
        { status: 500 }
      );
    }

    const responsePayload = {
      success: true,
      count: inserted?.length || 0,
      rejectedCount: errors.length,
      orders: inserted as Order[],
      errors: errors.length > 0 ? errors : undefined,
    };

    await recordIdempotency(idempotencyKey, requestPath, 201, responsePayload);

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
