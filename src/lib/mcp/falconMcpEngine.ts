import { getAutomationSupabaseClient } from "@/lib/api-auth";
import { parseOrderText } from "@/lib/orderTextParser";
import { calculateCod, calculateNetProfit, derivePaymentStatus } from "@/lib/calculations";
import { normalizePhoneNumber } from "@/lib/excel-import";
import { calculateCustomerRisk } from "@/lib/risk/customerRiskEngine";
import { createAuditEvent } from "@/lib/audit/orderAuditEngine";
import { Order, OrderInsert, DeliveryStatus } from "@/types/database";

export const MCP_SERVER_INFO = {
  name: "falcon-shipping-mcp",
  version: "1.0.0",
  protocolVersion: "2024-11-05",
};

export interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * List of tools exposed to AI Models (Claude, Antigravity, Cursor, etc.)
 */
export const FALCON_MCP_TOOLS = [
  {
    name: "get_store_kpis",
    description: "استعلام عن مؤشرات الأداء الحية للمتجر (إجمالي الأوردرات، قيد الطباعة، مع المندوب، تم التسليم، المرتجعات، وإجمالي أموال COD)",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "list_orders",
    description: "البحث في شحنات وأوردرات المتجر مع دعم التصفية حسب الحالة، المحافظة، والبحث برقم الهاتف أو اسم العميل",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "بحث باسم العميل، رقم الهاتف، أو العنوان" },
        delivery_status: {
          type: "string",
          enum: ["all", "new", "handed_to_carrier", "delivered", "returned"],
          description: "حالة التوصيل للشحنة",
        },
        print_status: {
          type: "string",
          enum: ["all", "pending", "printed"],
          description: "حالة طباعة البوليصة",
        },
        settlement_status: {
          type: "string",
          enum: ["all", "pending", "settled"],
          description: "حالة تسوية وتحصيل الأموال من شركة الشحن",
        },
        limit: { type: "number", description: "أقصى عدد للنتائج (افتراضياً 20)" },
      },
      required: [],
    },
  },
  {
    name: "create_order",
    description: "إنشاء أوردر جديد في النظام؛ يدعم إما تمرير الحقول مفصلة أو تمرير نص حر غير مهيكل بالعامية المصرية ليتم تحليله واستخراجه تلقائياً",
    inputSchema: {
      type: "object",
      properties: {
        raw_text: {
          type: "string",
          description: "نص الأوردر الخام المنسوخ من واتساب أو ماسنجر بالعامية المصرية (اختياري إذا تم تمرير الحقول)",
        },
        customer_name: { type: "string", description: "اسم العميل المستلم" },
        phone_primary: { type: "string", description: "رقم هاتف العميل الأساسي (مصري 11 رقم)" },
        phone_secondary: { type: "string", description: "رقم هاتف بديل إضافي (اختياري)" },
        governorate: { type: "string", description: "المحافظة المصرية (القاهرة، الجيزة، الإسكندرية...)" },
        address: { type: "string", description: "العنوان بالتفصيل" },
        landmark: { type: "string", description: "علامة مميزة (اختياري)" },
        order_total: { type: "number", description: "إجمالي قيمة الأوردر بالجنيه المصري" },
        paid_amount: { type: "number", description: "المبلغ المدفوع مقدماً كعربون (0 إذا لم يدفع)" },
        shipping_cost: { type: "number", description: "سعر الشحن للشركة (افتراضياً 65)" },
        important_notes: { type: "string", description: "ملاحظات إضافية أو وقت الاستلام" },
      },
      required: [],
    },
  },
  {
    name: "get_courier_dues",
    description: "حساب رادار مستحقات التاجر المالية المعلقة لدى شركات ومناديب الشحن (كم لي عند بوسطة، أرامكس، جي آند تي، إلخ)",
    inputSchema: {
      type: "object",
      properties: {
        carrier_name: { type: "string", description: "اسم شركة شحن معينة (اختياري، إن ترك فارغاً يعيد تقريراً شاملاً)" },
      },
      required: [],
    },
  },
  {
    name: "check_customer_risk",
    description: "فحص أمان العميل وسجل النصب والمرتجعات (مؤشر الاحتيال، إجمالي طلباته السابقة، ونسبة الرفض عند الاستلام)",
    inputSchema: {
      type: "object",
      properties: {
        phone: { type: "string", description: "رقم هاتف العميل المراد فحصه" },
        name: { type: "string", description: "اسم العميل (اختياري)" },
      },
      required: ["phone"],
    },
  },
  {
    name: "update_order_status",
    description: "تحديث حالة شحنة معينة (تسليم لمندوب، تم التسليم بنجاح، مرتجع، أو إلغاء) مع تسجيل أثر التدقيق",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "معرف الأوردر في النظام" },
        delivery_status: {
          type: "string",
          enum: ["new", "handed_to_carrier", "delivered", "returned"],
          description: "حالة الشحنة الجديدة",
        },
        reason: { type: "string", description: "سبب التحديث أو ملاحظات المندوب" },
      },
      required: ["order_id", "delivery_status"],
    },
  },
  {
    name: "track_order",
    description: "تتبع شحنة والحصول على الخط الزمني وحالتها الحالية ورابط التتبع المباشر",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "كود الأوردر أو رقم هاتف العميل" },
      },
      required: ["identifier"],
    },
  },
  {
    name: "parse_order_text",
    description: "تشغيل المحلل الذكي للنصوص العربية والمصرية لاستخراج بيانات الشحنة من رسالة عميل دون حفظها",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "نص الرسالة أو المنشور" },
      },
      required: ["text"],
    },
  },
];

/**
 * List of live resources provided by the MCP server
 */
export const FALCON_MCP_RESOURCES = [
  {
    uri: "falcon://orders/summary",
    name: "Live Orders & COD Financial Summary",
    mimeType: "application/json",
    description: "الملخص الشامل لأوردرات المتجر وأرصدة الـ COD وموقف الشحن الميداني",
  },
  {
    uri: "falcon://orders/pending",
    name: "Pending Orders Ready for Dispatch",
    mimeType: "application/json",
    description: "قائمة الشحنات المعلقة والجاهزة للتجهيز والطباعة",
  },
  {
    uri: "falcon://settlements/dues",
    name: "Courier Outstanding Balances",
    mimeType: "application/json",
    description: "مستحقات التاجر المالية غير المحصلة لدى شركات الشحن",
  },
];

/**
 * Prompts exposed to the AI model
 */
export const FALCON_MCP_PROMPTS = [
  {
    name: "daily_morning_briefing",
    description: "توليد تقرير وإحاطة صباحية شاملة للتاجر عن أوردرات اليوم وأموال الشحن المعلقة",
    arguments: [],
  },
  {
    name: "whatsapp_rescue_script",
    description: "صياغة رسالة واتساب باللهجة المصرية لإنقاذ شحنة معلقة أو مرتجعة وإقناع العميل بالاستلام",
    arguments: [
      { name: "customer_name", description: "اسم العميل", required: true },
      { name: "order_id", description: "كود الشحنة", required: true },
      { name: "courier_note", description: "ملاحظة مندوب الشحن (مثل: العميل مغلق، غير متواجد)", required: false },
    ],
  },
];

/**
 * Executes a tool requested by the AI client
 */
export async function executeMcpTool(
  name: string,
  args: Record<string, any> = {},
  customSupabase?: any
): Promise<any> {
  const supabase = customSupabase || (await getAutomationSupabaseClient());

  switch (name) {
    case "get_store_kpis": {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, cod_amount, order_total, delivery_status, print_status, settlement_status")
        .is("deleted_at", null);

      if (error) throw new Error(error.message);

      const list: any[] = orders || [];
      const totalOrders = list.length;
      let totalCod = 0;
      let newOrders = 0;
      let handedToCarrier = 0;
      let delivered = 0;
      let returned = 0;
      let unprinted = 0;
      let pendingSettlementCod = 0;

      list.forEach((o) => {
        const cod = Number(o.cod_amount || 0);
        totalCod += cod;
        if (o.delivery_status === "new") newOrders++;
        else if (o.delivery_status === "handed_to_carrier") handedToCarrier++;
        else if (o.delivery_status === "delivered") delivered++;
        else if (o.delivery_status === "returned") returned++;

        if (o.print_status === "pending") unprinted++;
        if (o.settlement_status === "pending" && o.delivery_status === "delivered") {
          pendingSettlementCod += cod;
        }
      });

      return {
        total_orders_count: totalOrders,
        total_cod_amount: totalCod,
        delivery_breakdown: {
          new: newOrders,
          handed_to_carrier: handedToCarrier,
          delivered: delivered,
          returned: returned,
        },
        print_queue_unprinted: unprinted,
        delivered_unsettled_cod: pendingSettlementCod,
        timestamp: new Date().toISOString(),
      };
    }

    case "list_orders": {
      const limit = Math.min(Number(args.limit) || 20, 100);
      let query = supabase
        .from("orders")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (args.delivery_status && args.delivery_status !== "all") {
        query = query.eq("delivery_status", args.delivery_status);
      }
      if (args.print_status && args.print_status !== "all") {
        query = query.eq("print_status", args.print_status);
      }
      if (args.settlement_status && args.settlement_status !== "all") {
        query = query.eq("settlement_status", args.settlement_status);
      }
      if (args.search?.trim()) {
        const term = args.search.trim();
        query = query.or(
          `customer_name.ilike.%${term}%,phone_primary.ilike.%${term}%,address.ilike.%${term}%,governorate.ilike.%${term}%`
        );
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return {
        count: (data || []).length,
        orders: data || [],
      };
    }

    case "create_order": {
      let orderData: Partial<OrderInsert> = {};

      if (args.raw_text?.trim()) {
        const parsed = parseOrderText(args.raw_text);
        orderData = {
          customer_name: parsed.customer_name || args.customer_name || "عميل بدون اسم",
          phone_primary: parsed.phone_primary || normalizePhoneNumber(args.phone_primary || ""),
          phone_secondary: parsed.phone_secondary || args.phone_secondary || null,
          governorate: parsed.governorate || args.governorate || "القاهرة",
          address: parsed.address || args.address || "غير محدد",
          landmark: parsed.landmark || args.landmark || null,
          order_total: parsed.order_total || Number(args.order_total || 0),
          paid_amount: parsed.paid_amount || Number(args.paid_amount || 0),
          shipping_cost: Number(args.shipping_cost || 65),
          important_notes: parsed.important_notes || args.important_notes || null,
        };
      } else {
        orderData = {
          customer_name: args.customer_name,
          phone_primary: normalizePhoneNumber(args.phone_primary || ""),
          phone_secondary: args.phone_secondary ? normalizePhoneNumber(args.phone_secondary) : null,
          governorate: args.governorate || "القاهرة",
          address: args.address || "غير محدد",
          landmark: args.landmark || null,
          order_total: Number(args.order_total || 0),
          paid_amount: Number(args.paid_amount || 0),
          shipping_cost: Number(args.shipping_cost || 65),
          important_notes: args.important_notes || null,
        };
      }

      if (!orderData.customer_name) throw new Error("اسم العميل مطلوب");
      if (!orderData.phone_primary) throw new Error("رقم هاتف العميل مطلوب");

      const cod = calculateCod(orderData.order_total!, orderData.paid_amount!);
      const profit = calculateNetProfit(orderData.order_total!, orderData.shipping_cost!);
      const paymentStatus = derivePaymentStatus(orderData.order_total!, orderData.paid_amount!);

      const payload: OrderInsert = {
        customer_name: orderData.customer_name,
        phone_primary: orderData.phone_primary,
        phone_secondary: orderData.phone_secondary,
        governorate: orderData.governorate!,
        address: orderData.address!,
        landmark: orderData.landmark,
        order_total: orderData.order_total!,
        paid_amount: orderData.paid_amount!,
        cod_amount: cod,
        shipping_cost: orderData.shipping_cost!,
        net_profit: profit,
        payment_status: paymentStatus,
        print_status: "pending",
        delivery_status: "new",
        settlement_status: "pending",
        order_date: new Date().toISOString().split("T")[0],
        important_notes: orderData.important_notes,
      };

      const { data, error } = await (supabase.from("orders") as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error("فشل إنشاء الأوردر: " + error.message);

      return {
        success: true,
        message: "تم إنشاء الأوردر بنجاح في نظام Falcon Shipping",
        order: data,
      };
    }

    case "get_courier_dues": {
      const { data, error } = await supabase
        .from("orders")
        .select("id, cod_amount, delivery_status, settlement_status, shipping_cost, important_notes")
        .is("deleted_at", null);

      if (error) throw new Error(error.message);

      const orders: any[] = data || [];
      const carrierMap: Record<string, { totalOrders: number; pendingCodDues: number; deliveredCount: number }> = {};

      orders.forEach((o) => {
        let carrier = "بوسطة (Bosta)";
        if (o.important_notes?.includes("جي آند تي") || o.important_notes?.includes("J&T")) {
          carrier = "جي آند تي (J&T Express)";
        } else if (o.important_notes?.includes("أرامكس") || o.important_notes?.includes("Aramex")) {
          carrier = "أرامكس (Aramex)";
        }

        if (!carrierMap[carrier]) {
          carrierMap[carrier] = { totalOrders: 0, pendingCodDues: 0, deliveredCount: 0 };
        }

        carrierMap[carrier].totalOrders++;
        if (o.delivery_status === "delivered") {
          carrierMap[carrier].deliveredCount++;
          if (o.settlement_status === "pending") {
            carrierMap[carrier].pendingCodDues += Number(o.cod_amount || 0);
          }
        }
      });

      return {
        outstanding_courier_dues: carrierMap,
        total_unsettled_cod: Object.values(carrierMap).reduce((s, c) => s + c.pendingCodDues, 0),
      };
    }

    case "check_customer_risk": {
      const phone = normalizePhoneNumber(args.phone);
      const { data: previousOrders } = await supabase
        .from("orders")
        .select("*")
        .eq("phone_primary", phone)
        .is("deleted_at", null);

      const risk = calculateCustomerRisk(phone, (previousOrders || []) as Order[], []);
      return {
        phone,
        risk_score: risk.riskScore,
        risk_level: risk.riskLevel,
        recommendation: risk.recommendation,
        recommendation_ar: risk.recommendationTextAr,
        total_previous_orders: risk.totalOrders,
        delivered_orders: risk.deliveredOrders,
        returned_orders: risk.returnedOrders,
        return_rate_percentage: risk.returnRate,
        is_blacklisted: risk.isBlacklisted,
        is_safe_to_ship: risk.riskLevel === "safe" || risk.riskLevel === "medium",
        total_penalty_loss_caused: risk.totalPenaltyLossCaused,
      };
    }

    case "update_order_status": {
      const orderId = args.order_id;
      const newStatus = args.delivery_status as DeliveryStatus;

      const { data, error } = await (supabase.from("orders") as any)
        .update({
          delivery_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) throw new Error("تعذر تحديث الأوردر: " + error.message);

      return {
        success: true,
        order_id: orderId,
        new_status: newStatus,
        order: data,
      };
    }

    case "track_order": {
      const iden = (args.identifier || "").trim();
      let query = supabase.from("orders").select("*").is("deleted_at", null);

      if (iden.length === 11 && iden.startsWith("01")) {
        query = query.eq("phone_primary", iden);
      } else {
        query = query.eq("id", iden);
      }

      const { data: order, error } = await query.maybeSingle();
      if (error || !order) {
        return { found: false, message: "لم يتم العثور على أوردر مطابق" };
      }

      return {
        found: true,
        order_id: order.id,
        customer_name: order.customer_name,
        governorate: order.governorate,
        delivery_status: order.delivery_status,
        cod_amount: order.cod_amount,
        tracking_url: `/track/${order.id}`,
        last_updated: order.updated_at,
      };
    }

    case "parse_order_text": {
      return parseOrderText(args.text || "");
    }

    default:
      throw new Error(`Tool "${name}" is not implemented by Falcon MCP Server.`);
  }
}

/**
 * Handles incoming JSON-RPC 2.0 requests following Model Context Protocol specs
 */
export async function handleMcpJsonRpc(request: McpJsonRpcRequest): Promise<McpJsonRpcResponse> {
  const { id = null, method, params = {} } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: MCP_SERVER_INFO.protocolVersion,
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
            serverInfo: {
              name: MCP_SERVER_INFO.name,
              version: MCP_SERVER_INFO.version,
            },
          },
        };

      case "notifications/initialized":
      case "ping":
        return { jsonrpc: "2.0", id, result: {} };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: FALCON_MCP_TOOLS,
          },
        };

      case "tools/call": {
        const toolName = params.name;
        const toolArgs = params.arguments || {};
        if (!toolName) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Invalid params: tool name is required." },
          };
        }

        const data = await executeMcpTool(toolName, toolArgs);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
              },
            ],
          },
        };
      }

      case "resources/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            resources: FALCON_MCP_RESOURCES,
          },
        };

      case "resources/read": {
        const uri = params.uri;
        let contentsText = "";

        if (uri === "falcon://orders/summary") {
          const kpis = await executeMcpTool("get_store_kpis");
          contentsText = JSON.stringify(kpis, null, 2);
        } else if (uri === "falcon://orders/pending") {
          const pending = await executeMcpTool("list_orders", { print_status: "pending", limit: 50 });
          contentsText = JSON.stringify(pending, null, 2);
        } else if (uri === "falcon://settlements/dues") {
          const dues = await executeMcpTool("get_courier_dues");
          contentsText = JSON.stringify(dues, null, 2);
        } else {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32002, message: `Resource not found: ${uri}` },
          };
        }

        return {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: contentsText,
              },
            ],
          },
        };
      }

      case "prompts/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            prompts: FALCON_MCP_PROMPTS,
          },
        };

      case "prompts/get": {
        const promptName = params.name;
        if (promptName === "daily_morning_briefing") {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: "أنت المساعد المالي واللوجستي الذكي لمتجر Falcon Shipping. يرجى استدعاء أداة get_store_kpis وأداة get_courier_dues، وتقديم تقرير صباحي مرتب للتاجر بالعامية المصرية الراقية يوضح: كم طرد جاهز للطباعة اليوم؟ كم إجمالي مبالغ التحصيل بالجنيه؟ وما هي المبالغ المستحقة لنا عند شركات الشحن؟",
                  },
                },
              ],
            },
          };
        }

        if (promptName === "whatsapp_rescue_script") {
          const cName = params.arguments?.customer_name || "العميل";
          const oId = params.arguments?.order_id || "#ORD";
          const note = params.arguments?.courier_note || "المندوب حاول الاتصال";
          return {
            jsonrpc: "2.0",
            id,
            result: {
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: `قم بصياغة رسالة واتساب ودية ومحترفة بالعامية المصرية للعميل (${cName}) بخصوص أوردره (${oId})؛ أفاده مندوب الشحن بأن (${note})، لإقناع العميل بتحديد موعد استلام مناسب والحفاظ على الشحنة من الارتجاع.`,
                  },
                },
              ],
            },
          };
        }

        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Prompt not found: ${promptName}` },
        };
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (err: any) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: err.message || "Internal server error during MCP call execution.",
      },
    };
  }
}
