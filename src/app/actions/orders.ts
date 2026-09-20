"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateCod, calculateNetProfit, derivePaymentStatus } from "@/lib/calculations";
import { Order, OrderInsert, OrderUpdate, PrintStatus, DeliveryStatus, SettlementStatus, PaymentStatus } from "@/types/database";

export interface CreateOrderInput {
  customer_name: string;
  phone_primary: string;
  phone_secondary?: string | null;
  governorate: string;
  address: string;
  landmark?: string | null;
  important_notes?: string | null;
  order_total: number;
  paid_amount?: number;
  shipping_cost: number;
  order_date?: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GetOrdersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  printStatus?: string;
  deliveryStatus?: string;
  settlementStatus?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedOrdersResult {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getOrdersAction(
  params: GetOrdersParams
): Promise<ActionResult<PaginatedOrdersResult>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const page = Math.max(Number(params.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(params.pageSize || 50), 10), 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (params.search?.trim()) {
      const term = params.search.trim();
      query = query.or(
        `customer_name.ilike.%${term}%,phone_primary.ilike.%${term}%,phone_secondary.ilike.%${term}%,governorate.ilike.%${term}%,address.ilike.%${term}%`
      );
    }

    if (params.printStatus && params.printStatus !== "all") {
      query = query.eq("print_status", params.printStatus);
    }

    if (params.deliveryStatus && params.deliveryStatus !== "all") {
      query = query.eq("delivery_status", params.deliveryStatus);
    }

    if (params.settlementStatus && params.settlementStatus !== "all") {
      query = query.eq("settlement_status", params.settlementStatus);
    }

    if (params.paymentStatus && params.paymentStatus !== "all") {
      query = query.eq("payment_status", params.paymentStatus);
    }

    if (params.startDate) {
      query = query.gte("order_date", params.startDate);
    }

    if (params.endDate) {
      query = query.lte("order_date", params.endDate);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: "حدث خطأ أثناء جلب الطلبات: " + error.message };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      success: true,
      data: {
        orders: (data || []) as Order[],
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: "تعذر تحميل الطلبات: " + msg };
  }
}

export async function getOrdersByIdsAction(
  orderIds: string[]
): Promise<ActionResult<Order[]>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("id", orderIds)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: "فشل جلب البوالص: " + error.message };
    }

    return { success: true, data: (data || []) as Order[] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: "تعذر تحميل البوالص: " + msg };
  }
}

export async function createOrderAction(
  input: CreateOrderInput
): Promise<ActionResult<Order>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً للمتابعة",
      };
    }

    const customerName = (input.customer_name || "").trim();
    const phonePrimary = (input.phone_primary || "").trim();
    const phoneSecondary = (input.phone_secondary || "").trim() || null;
    const governorate = (input.governorate || "").trim();
    const address = (input.address || "").trim();
    const landmark = (input.landmark || "").trim() || null;
    const importantNotes = (input.important_notes || "").trim() || null;

    const orderTotal = Number(input.order_total);
    const paidAmount = Number(input.paid_amount ?? 0);
    const shippingCost = Number(input.shipping_cost ?? 0);
    const orderDate = input.order_date || new Date().toISOString().split("T")[0];

    if (!customerName) {
      return { success: false, error: "اسم العميل مطلوب" };
    }
    if (!phonePrimary) {
      return { success: false, error: "رقم الهاتف الأساسي مطلوب" };
    }
    if (!governorate) {
      return { success: false, error: "المحافظة مطلوبة" };
    }
    if (!address) {
      return { success: false, error: "العنوان بالتفصيل مطلوب" };
    }

    if (isNaN(orderTotal) || orderTotal < 0) {
      return { success: false, error: "سعر الأوردر الكامل يجب أن يكون قيمة موجبة أو صفر" };
    }
    if (isNaN(paidAmount) || paidAmount < 0) {
      return { success: false, error: "المبلغ المدفوع مقدمًا لا يمكن أن يكون سالباً" };
    }
    if (paidAmount > orderTotal) {
      return {
        success: false,
        error: "المبلغ المدفوع مقدمًا لا يمكن أن يتجاوز إجمالي سعر الأوردر",
      };
    }
    if (isNaN(shippingCost) || shippingCost < 0) {
      return { success: false, error: "سعر الشحن يجب أن يكون قيمة موجبة أو صفر" };
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

    const { data, error } = await supabase
      .from("orders")
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: "حدث خطأ أثناء حفظ الأوردر في قاعدة البيانات: " + error.message,
      };
    }

    return {
      success: true,
      data: data as Order,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ غير متوقع";
    return {
      success: false,
      error: "تعذر إنشاء الأوردر: " + message,
    };
  }
}

export async function batchCreateOrdersAction(
  orders: OrderInsert[]
): Promise<ActionResult<{ count: number; ids: string[] }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً للمتابعة",
      };
    }

    if (!Array.isArray(orders) || orders.length === 0) {
      return { success: false, error: "لا توجد أوردرات صالحة للإدراج" };
    }

    const BATCH_SIZE = 50;
    const insertedIds: string[] = [];

    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
      const chunk = orders.slice(i, i + BATCH_SIZE);
      const { data, error } = await (supabase
        .from("orders") as any)
        .insert(chunk)
        .select("id");

      if (error) {
        return {
          success: false,
          error: "حدث خطأ أثناء إدراج الدفعة: " + error.message,
        };
      }

      if (data) {
        insertedIds.push(...data.map((d: any) => d.id));
      }
    }

    return {
      success: true,
      data: {
        count: insertedIds.length,
        ids: insertedIds,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ غير متوقع";
    return {
      success: false,
      error: "تعذر إدراج الأوردرات جماعياً: " + message,
    };
  }
}

export async function updateOrderAction(
  orderId: string,
  updates: Partial<OrderUpdate>
): Promise<ActionResult<Order>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    if (!orderId) {
      return { success: false, error: "معرف الأوردر غير موجود" };
    }

    // Recalculate financial fields if total or paid amount changed
    const payload: Record<string, unknown> = { ...updates };
    if (updates.order_total !== undefined || updates.paid_amount !== undefined) {
      const orderTotal = Number(updates.order_total);
      const paidAmount = Number(updates.paid_amount ?? 0);
      if (paidAmount > orderTotal) {
        return { success: false, error: "المبلغ المدفوع لا يمكن أن يتجاوز سعر الأوردر" };
      }
      payload.cod_amount = calculateCod(orderTotal, paidAmount);
      payload.payment_status = derivePaymentStatus(orderTotal, paidAmount);
    }

    if (updates.order_total !== undefined && updates.shipping_cost !== undefined) {
      payload.net_profit = calculateNetProfit(Number(updates.order_total), Number(updates.shipping_cost));
    }

    payload.updated_at = new Date().toISOString();

    const { data, error } = await (supabase
      .from("orders") as any)
      .update(payload)
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      return { success: false, error: "فشل في تحديث الأوردر: " + error.message };
    }

    return { success: true, data: data as Order };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: "تعذر تحديث الأوردر: " + msg };
  }
}

export async function batchUpdatePrintStatusAction(
  orderIds: string[],
  printStatus: PrintStatus
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return { success: false, error: "لم يتم تحديد أي أوردرات" };
    }

    const payload: Record<string, unknown> = {
      print_status: printStatus,
      updated_at: new Date().toISOString(),
    };

    if (printStatus === "printed") {
      payload.printed_at = new Date().toISOString();
    } else {
      payload.printed_at = null;
    }

    const { error, count } = await (supabase
      .from("orders") as any)
      .update(payload)
      .in("id", orderIds);

    if (error) {
      return { success: false, error: "فشل تحديث حالة الطباعة: " + error.message };
    }

    return { success: true, data: { updatedCount: count || orderIds.length } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: "تعذر تحديث حالة الطباعة: " + msg };
  }
}

export interface DashboardMetrics {
  totalOrders: number;
  totalOrderValue: number;
  totalPaidAmount: number;
  totalCod: number;
  totalShippingCost: number;
  falconNetProfit: number;
  printPendingCount: number;
  printedCount: number;
  pendingCarrierCod: number;
  settledCarrierCod: number;
  recentOrders: Order[];
  topGovernorates: { governorate: string; count: number; totalCod: number }[];
  deliveryCounts: Record<DeliveryStatus, number>;
}

export async function getDashboardMetricsAction(): Promise<ActionResult<DashboardMetrics>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    const { data: allOrders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersError) {
      return { success: false, error: "فشل جلب إحصائيات لوحة التحكم: " + ordersError.message };
    }

    const orders = (allOrders || []) as Order[];

    let totalOrderValue = 0;
    let totalPaidAmount = 0;
    let totalCod = 0;
    let totalShippingCost = 0;
    let falconNetProfit = 0;
    let printPendingCount = 0;
    let printedCount = 0;
    let pendingCarrierCod = 0;
    let settledCarrierCod = 0;

    const deliveryCounts: Record<DeliveryStatus, number> = {
      new: 0,
      handed_to_carrier: 0,
      delivered: 0,
      returned: 0,
    };

    const govMap = new Map<string, { count: number; totalCod: number }>();

    for (const ord of orders) {
      totalOrderValue += Number(ord.order_total || 0);
      totalPaidAmount += Number(ord.paid_amount || 0);
      totalCod += Number(ord.cod_amount || 0);
      totalShippingCost += Number(ord.shipping_cost || 0);
      falconNetProfit += Number(ord.net_profit || 0);

      if (ord.print_status === "pending") printPendingCount++;
      if (ord.print_status === "printed") printedCount++;

      if (ord.delivery_status in deliveryCounts) {
        deliveryCounts[ord.delivery_status]++;
      }

      // Pending carrier cash: delivered orders with settlement_status = 'pending'
      if (ord.delivery_status === "delivered" && ord.settlement_status === "pending") {
        pendingCarrierCod += Number(ord.cod_amount || 0);
      }

      if (ord.settlement_status === "settled") {
        settledCarrierCod += Number(ord.cod_amount || 0);
      }

      // Governorates breakdown
      const gov = ord.governorate || "غير محدد";
      const currGov = govMap.get(gov) || { count: 0, totalCod: 0 };
      currGov.count++;
      currGov.totalCod += Number(ord.cod_amount || 0);
      govMap.set(gov, currGov);
    }

    const topGovernorates = Array.from(govMap.entries())
      .map(([governorate, stats]) => ({
        governorate,
        count: stats.count,
        totalCod: stats.totalCod,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const recentOrders = orders.slice(0, 8);

    return {
      success: true,
      data: {
        totalOrders: orders.length,
        totalOrderValue,
        totalPaidAmount,
        totalCod,
        totalShippingCost,
        falconNetProfit,
        printPendingCount,
        printedCount,
        pendingCarrierCod,
        settledCarrierCod,
        recentOrders,
        topGovernorates,
        deliveryCounts,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: "تعذر احتساب المؤشرات: " + msg };
  }
}

export async function batchUpdateSettlementStatusAction(
  orderIds: string[],
  settlementStatus: SettlementStatus
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return { success: false, error: "لم يتم تحديد أي أوردرات" };
    }

    const payload: Record<string, unknown> = {
      settlement_status: settlementStatus,
      updated_at: new Date().toISOString(),
    };

    if (settlementStatus === "settled") {
      payload.settled_at = new Date().toISOString();
    } else {
      payload.settled_at = null;
    }

    const { error, count } = await (supabase
      .from("orders") as any)
      .update(payload)
      .in("id", orderIds);

    if (error) {
      return { success: false, error: "فشل تحديث حالة التسوية: " + error.message };
    }

    return { success: true, data: { updatedCount: count || orderIds.length } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: "تعذر تحديث حالة التسوية: " + msg };
  }
}

export async function batchUpdateDeliveryStatusAction(
  orderIds: string[],
  deliveryStatus: DeliveryStatus
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "انتهت جلستك، يرجى تسجيل الدخول مجدداً" };
    }

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return { success: false, error: "لم يتم تحديد أي أوردرات" };
    }

    const payload: Record<string, unknown> = {
      delivery_status: deliveryStatus,
      updated_at: new Date().toISOString(),
    };

    const { error, count } = await (supabase
      .from("orders") as any)
      .update(payload)
      .in("id", orderIds);

    if (error) {
      return { success: false, error: "فشل تحديث حالة التوصيل: " + error.message };
    }

    return { success: true, data: { updatedCount: count || orderIds.length } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { success: false, error: "تعذر تحديث حالة التوصيل: " + msg };
  }
}
