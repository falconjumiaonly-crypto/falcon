import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateOrdersExcelBuffer,
  generateCarrierSettlementExcelBuffer,
  generateCarrierOrdersExcelBuffer,
  CARRIER_TEMPLATES,
  CarrierType,
} from "@/lib/excel";
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
    const rawCarrier = searchParams.get("carrier") as CarrierType | null;
    const rawIds = searchParams.get("ids");
    const updateStatusToHanded =
      searchParams.get("updateStatus") === "true" || searchParams.get("updateStatus") === "1";

    let carrier: CarrierType = "standard";
    if (type === "carrier_settlement") {
      carrier = "carrier_settlement";
    } else if (rawCarrier && CARRIER_TEMPLATES[rawCarrier]) {
      carrier = rawCarrier;
    }

    let query = supabase
      .from("orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (carrier === "carrier_settlement") {
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

    // Auto-update to 'handed_to_carrier' if requested
    if (updateStatusToHanded && orderList.length > 0) {
      const idsToUpdate = orderList.map((o) => o.id);
      await (supabase
        .from("orders") as any)
        .update({
          delivery_status: "handed_to_carrier",
          updated_at: new Date().toISOString(),
        })
        .in("id", idsToUpdate);
    }

    const templateInfo = CARRIER_TEMPLATES[carrier];
    const excelBuffer = generateCarrierOrdersExcelBuffer(orderList, carrier);
    const fileName = `${templateInfo.filePrefix}_${todayStr}.xlsx`;

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
      carrier: requestedCarrier = "standard", // 'bosta' | 'jt' | 'aramex' | 'mylerz' | 'standard'
      updateStatusToHanded = false,
      selectedIds = [],
      search = "",
      printStatus = "",
      deliveryStatus = "",
      settlementStatus = "",
      paymentStatus = "",
      startDate = "",
      endDate = "",
      sheetName,
      fileNamePrefix,
      options,
    } = body;

    let carrier: CarrierType = "standard";
    if (exportType === "carrier_settlement") {
      carrier = "carrier_settlement";
    } else if (requestedCarrier && CARRIER_TEMPLATES[requestedCarrier as CarrierType]) {
      carrier = requestedCarrier as CarrierType;
    }

    let query = supabase
      .from("orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (carrier === "carrier_settlement") {
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

    // Automatically mark exported orders as handed to courier if requested!
    if (updateStatusToHanded && orderList.length > 0) {
      const idsToUpdate = orderList.map((o) => o.id);
      await (supabase
        .from("orders") as any)
        .update({
          delivery_status: "handed_to_carrier",
          updated_at: new Date().toISOString(),
        })
        .in("id", idsToUpdate);
    }

    const templateInfo = CARRIER_TEMPLATES[carrier];
    const excelBuffer = generateCarrierOrdersExcelBuffer(orderList, carrier, options);
    const finalFileName = `${fileNamePrefix || templateInfo.filePrefix}_${todayStr}.xlsx`;

    return new NextResponse(Buffer.from(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${finalFileName}"`,
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
