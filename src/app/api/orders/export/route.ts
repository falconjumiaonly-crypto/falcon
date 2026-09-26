import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOrdersExcelBuffer, generateCarrierSettlementExcelBuffer } from "@/lib/excel";
import { Order } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "غير مصرح لك بتصدير البيانات" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'carrier_settlement' | 'standard'
    const rawIds = searchParams.get("ids");

    let query = supabase
      .from("orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (type === "carrier_settlement") {
      // Only delivered orders with pending settlement
      query = query.eq("delivery_status", "delivered").eq("settlement_status", "pending");
    } else if (rawIds) {
      const ids = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        query = query.in("id", ids);
      }
    }

    const { data: orders, error: queryError } = await query;
    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    const orderList = (orders || []) as Order[];
    const todayStr = new Date().toISOString().split("T")[0];

    let excelBuffer: Uint8Array;
    let fileName: string;

    if (type === "carrier_settlement") {
      excelBuffer = generateCarrierSettlementExcelBuffer(orderList);
      fileName = `Falcon_Pending_Carrier_Settlements_${todayStr}.xlsx`;
    } else {
      excelBuffer = generateOrdersExcelBuffer(orderList, "الطلبات");
      fileName = `Falcon_Orders_${todayStr}.xlsx`;
    }

    return new NextResponse(Buffer.from(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "غير مصرح لك بتصدير البيانات" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      mode = "filtered", // 'selected' | 'filtered' | 'all'
      exportType = "standard", // 'standard' | 'carrier_settlement'
      selectedIds = [],
      search = "",
      printStatus = "",
      deliveryStatus = "",
      settlementStatus = "",
      paymentStatus = "",
      startDate = "",
      endDate = "",
      sheetName = "الطلبات",
      fileNamePrefix = "Falcon_Orders",
    } = body;

    let query = supabase
      .from("orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (exportType === "carrier_settlement") {
      query = query.eq("delivery_status", "delivered").eq("settlement_status", "pending");
    } else if (mode === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
      query = query.in("id", selectedIds);
    } else if (mode === "filtered") {
      if (search?.trim()) {
        const term = search.trim();
        query = query.or(
          `customer_name.ilike.%${term}%,phone_primary.ilike.%${term}%,phone_secondary.ilike.%${term}%,address.ilike.%${term}%`
        );
      }
      if (printStatus && printStatus !== "all") {
        query = query.eq("print_status", printStatus);
      }
      if (deliveryStatus && deliveryStatus !== "all") {
        query = query.eq("delivery_status", deliveryStatus);
      }
      if (settlementStatus && settlementStatus !== "all") {
        query = query.eq("settlement_status", settlementStatus);
      }
      if (paymentStatus && paymentStatus !== "all") {
        query = query.eq("payment_status", paymentStatus);
      }
      if (startDate) {
        query = query.gte("order_date", startDate);
      }
      if (endDate) {
        query = query.lte("order_date", endDate);
      }
    }

    const { data: orders, error: queryError } = await query;

    if (queryError) {
      return NextResponse.json(
        { error: "فشل في جلب بيانات الطلبات: " + queryError.message },
        { status: 500 }
      );
    }

    const orderList = (orders || []) as Order[];
    const todayStr = new Date().toISOString().split("T")[0];

    let excelBuffer: Uint8Array;
    let fileName: string;

    if (exportType === "carrier_settlement") {
      excelBuffer = generateCarrierSettlementExcelBuffer(orderList);
      fileName = `Falcon_Pending_Carrier_Settlements_${todayStr}.xlsx`;
    } else {
      excelBuffer = generateOrdersExcelBuffer(orderList, sheetName);
      fileName = `${fileNamePrefix}_${todayStr}.xlsx`;
    }

    return new NextResponse(Buffer.from(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return NextResponse.json(
      { error: "حدث خطأ أثناء تصدير ملف Excel: " + msg },
      { status: 500 }
    );
  }
}
