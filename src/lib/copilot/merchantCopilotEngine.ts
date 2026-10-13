import { executeMcpTool } from "@/lib/mcp/falconMcpEngine";
import { normalizePhoneNumber } from "@/lib/excel-import";

export type CopilotActionType =
  | "dues"
  | "kpis"
  | "risk_check"
  | "order_created"
  | "tracking"
  | "rescue"
  | "info"
  | "error";

export interface CopilotActionCard {
  type: CopilotActionType;
  title: string;
  data: Record<string, any>;
  primaryAction?: { label: string; href?: string; actionId?: string };
}

export interface CopilotMessage {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
  actionType?: CopilotActionType;
  card?: CopilotActionCard;
  suggestedPrompts?: string[];
}

export const COPILOT_DEFAULT_PROMPTS = [
  "💰 مستحقاتي المعلقة عند شركات الشحن",
  "📊 مؤشرات ونبض أداء المتجر اليوم",
  "🛡️ افحص العميل 01012345678",
  "📦 سجل أوردر: أحمد علي 01012345678 المعادي 500ج",
  "🚨 حل وإنقاذ الأوردرات المرتجعة",
];

/**
 * Extracts Egyptian mobile numbers from conversational text (01xxxxxxxxx or +201xxxxxxxxx)
 */
export function extractEgyptianPhoneNumber(text: string): string | null {
  const match = text.match(/(?:(?:\+?20)?|0)?(1[0125][0-9]{8})\b/);
  if (match && match[1]) {
    return `0${match[1]}`;
  }
  return null;
}

/**
 * Checks if text is an order creation command or contains order fields
 */
function isOrderCreationIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const explicitCreation =
    lower.includes("سجل أوردر") ||
    lower.includes("أوردر جديد") ||
    lower.includes("سجل اوردر") ||
    lower.includes("اوردر جديد") ||
    lower.includes("اعمل شحنة") ||
    lower.includes("اضف طلب") ||
    lower.includes("أضف أوردر") ||
    lower.includes("create order");

  if (explicitCreation) return true;

  // Colloquial auto-detection: contains phone number + price/amount + address keywords
  const hasPhone = /(?:01|1)[0125][0-9]{8}/.test(text);
  const hasMoney = /(?:جنيه|ج|جـ|egp|le|\d+\s*ج)/i.test(text);
  const hasLocation = /(?:القاهرة|الجيزة|الإسكندرية|المعادي|مدينة نصر|فيصل|الهرم|التجمع|أكتوبر|شارع|عمارة|شقة)/i.test(text);

  return hasPhone && (hasMoney || hasLocation);
}

/**
 * Core Merchant Copilot AI Engine: Processes prompt, detects intent, calls MCP tools,
 * and formats actionable Egyptian-Arabic responses.
 */
export async function processMerchantCopilotMessage(
  userText: string,
  customSupabase?: any
): Promise<CopilotMessage> {
  const cleanText = userText.trim();
  const lowerText = cleanText.toLowerCase();
  const messageId = `copilot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  try {
    // 1. Customer Risk Check Intent
    if (
      lowerText.includes("افحص") ||
      lowerText.includes("فحص") ||
      lowerText.includes("نصاب") ||
      lowerText.includes("مخاطر") ||
      lowerText.includes("كشف عميل") ||
      lowerText.includes("check risk") ||
      lowerText.includes("risk")
    ) {
      const extractedPhone = extractEgyptianPhoneNumber(cleanText);
      if (!extractedPhone) {
        return {
          id: messageId,
          sender: "copilot",
          text: "من فضلك اكتب رقم تليفون العميل المراد فحصه (مثال: `افحص العميل 01012345678`).",
          timestamp: now,
          actionType: "info",
          suggestedPrompts: ["افحص 01012345678", "افحص 01234567890"],
        };
      }

      const riskResult = await executeMcpTool("check_customer_risk", { phone: extractedPhone }, customSupabase);
      const isHighRisk = riskResult.risk_level === "high" || riskResult.is_blacklisted;
      const isMedium = riskResult.risk_level === "medium";

      let statusEmoji = "✅";
      let summaryText = "";

      if (isHighRisk) {
        statusEmoji = "🚨";
        summaryText = `⚠️ **تحذير عالي الخطورة!**\nالعميل صاحب الرقم **${extractedPhone}** لديه مؤشر مخاطر مرتفع (${riskResult.risk_score}/100).\n• إجمالي الطلبات السابقة: ${riskResult.total_previous_orders}\n• نسبة المرتجعات: **${riskResult.return_rate_percentage}%**\n• خسائر غرامات الشحن المسببة: **${riskResult.total_penalty_loss_caused} ج**\n\n📌 **توصية فلكون:** ${riskResult.recommendation_ar || "لا تشحن بدون تحصيل عربون الشحن مسبقاً (100 ج على الأقل)."}`;
      } else if (isMedium) {
        statusEmoji = "⚠️";
        summaryText = `⚡ **عميل متوسط الخطورة** (${riskResult.risk_score}/100).\n• إجمالي الطلبات: ${riskResult.total_previous_orders} (تم تسليم ${riskResult.delivered_orders} ومرتجع ${riskResult.returned_orders}).\n• التوصية: ${riskResult.recommendation_ar}`;
      } else {
        statusEmoji = "✅";
        summaryText = `🎉 **عميل موثوق وآمن للشحن!** (${riskResult.risk_score}/100)\n• عدد الطلبات المسلمة بنجاح: ${riskResult.delivered_orders} من أصل ${riskResult.total_previous_orders}.\n• لا توجد سوابق نصب أو تهرب من الاستلام.\n• التوصية: الشحن فوري مع تأكيد الموعد هاتفياً.`;
      }

      return {
        id: messageId,
        sender: "copilot",
        text: summaryText,
        timestamp: now,
        actionType: "risk_check",
        card: {
          type: "risk_check",
          title: `${statusEmoji} تقرير فحص العميل ${extractedPhone}`,
          data: riskResult,
          primaryAction: {
            label: "سجل أوردر للعميل",
            actionId: `create_order_${extractedPhone}`,
          },
        },
        suggestedPrompts: [
          `سجل أوردر لرقم ${extractedPhone}`,
          "💰 استعلم عن مستحقات شركات الشحن",
          "📊 مؤشرات أداء المتجر",
        ],
      };
    }

    // 2. Order Creation from unstructured colloquial Arabic text
    if (isOrderCreationIntent(cleanText)) {
      const createRes = await executeMcpTool("create_order", { raw_text: cleanText }, customSupabase);
      const order = createRes.order;

      return {
        id: messageId,
        sender: "copilot",
        text: `🎉 **تم تسجيل وتأكيد الأوردر بنجاح يا فندم!** 🦅\n\n• **اسم العميل:** ${order.customer_name}\n• **الهاتف:** ${order.phone_primary}\n• **المحافظة والعنوان:** ${order.governorate} - ${order.address}\n• **المطلوب تحصيله (COD):** **${Number(order.cod_amount).toLocaleString()} جنيه مصري**\n• **رقم الشحنة بالنظام:** \`${order.id}\`\n\n✨ تمت إضافة الشحنة تلقائياً إلى **طابور الطباعة والتجهيز**.`,
        timestamp: now,
        actionType: "order_created",
        card: {
          type: "order_created",
          title: `📦 تم إنشاء الشحنة #${order.id.slice(0, 8)}`,
          data: order,
          primaryAction: {
            label: "طباعة البوليصة الحرارية",
            href: `/orders`,
          },
        },
        suggestedPrompts: [
          `تتبع الشحنة ${order.id}`,
          `افحص العميل ${order.phone_primary}`,
          "📊 مؤشرات المتجر اليوم",
        ],
      };
    }

    // 3. Courier Dues & Outstanding Cash Intent
    if (
      lowerText.includes("مستحقات") ||
      lowerText.includes("ليا كام") ||
      lowerText.includes("فلوس الشحن") ||
      lowerText.includes("شركة الشحن") ||
      lowerText.includes("بوسطة") ||
      lowerText.includes("أرامكس") ||
      lowerText.includes("ارامكس") ||
      lowerText.includes("جي آند تي") ||
      lowerText.includes("dues") ||
      lowerText.includes("ديون") ||
      lowerText.includes("cod")
    ) {
      const duesResult = await executeMcpTool("get_courier_dues", {}, customSupabase);
      const carrierMap = duesResult.outstanding_courier_dues || {};
      const totalUnsettled = Number(duesResult.total_unsettled_cod || 0);

      const carrierLines = Object.entries(carrierMap).map(([carrier, stat]: [string, any]) => {
        return `• **${carrier}:** **${Number(stat.pendingCodDues).toLocaleString()} ج** معلقة (${stat.deliveredCount} أوردر مسلّم ينتظر التحصيل).`;
      });

      const responseText = `💰 **رادار مستحقاتك المالية لدى شركات الشحن:**\n\nإجمالي مبالغ الـ COD المعلقة الواجب تحصيلها: **${totalUnsettled.toLocaleString()} جنيه مصري**.\n\n${carrierLines.join("\n")}\n\n💡 *نصيحة فلكون:* قم بطلب كشف التسوية الأسبوعي من مناديب الشحن لتحديث أرصدتك البنكية فوراً.`;

      return {
        id: messageId,
        sender: "copilot",
        text: responseText,
        timestamp: now,
        actionType: "dues",
        card: {
          type: "dues",
          title: "💵 ملخص مستحقات شركات الشحن المعلقة",
          data: duesResult,
          primaryAction: {
            label: "فتح شاشة التسويات ومطابقة الكشوف",
            href: "/settlements",
          },
        },
        suggestedPrompts: [
          "📊 نبض مؤشرات المتجر",
          "🚨 إنقاذ الأوردرات المرتجعة",
          "افحص العميل 01012345678",
        ],
      };
    }

    // 4. Store KPIs and Pulse Intent
    if (
      lowerText.includes("مؤشرات") ||
      lowerText.includes("أداء") ||
      lowerText.includes("نبض") ||
      lowerText.includes("كام أوردر") ||
      lowerText.includes("ملخص") ||
      lowerText.includes("تقرير") ||
      lowerText.includes("إحصائيات") ||
      lowerText.includes("kpi") ||
      lowerText.includes("stats")
    ) {
      const kpis = await executeMcpTool("get_store_kpis", {}, customSupabase);
      const delivery = kpis.delivery_breakdown || {};
      const total = Number(kpis.total_orders_count || 0);
      const delivered = Number(delivery.delivered || 0);
      const returned = Number(delivery.returned || 0);
      const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;

      const summaryText = `📊 **نبض المتجر اللحظي ومؤشرات الأداء:**\n\n• **إجمالي الشحنات:** ${total} أوردر\n• **في طابور الطباعة:** ${kpis.print_queue_unprinted} شحنة\n• **مع مناديب الشحن:** ${delivery.handed_to_carrier || 0} شحنة\n• **تم التسليم بنجاح:** ${delivered} شحنة\n• **مرتجعات:** ${returned} شحنة\n• **نسبة نجاح التوصيل:** **${rate}%**\n• **إجمالي أموال COD:** **${Number(kpis.total_cod_amount || 0).toLocaleString()} ج**\n• **مستحقات مسلّمة بانتظار التسوية:** **${Number(kpis.delivered_unsettled_cod || 0).toLocaleString()} ج**`;

      return {
        id: messageId,
        sender: "copilot",
        text: summaryText,
        timestamp: now,
        actionType: "kpis",
        card: {
          type: "kpis",
          title: "📈 لوحة مؤشرات الأداء الحية (Falcon Live Pulse)",
          data: kpis,
          primaryAction: {
            label: "عرض سجل الشحنات بالكامل",
            href: "/orders",
          },
        },
        suggestedPrompts: [
          "💰 كم لي عند شركات الشحن؟",
          "🚨 إنقاذ الأوردرات المرتجعة",
          "سجل أوردر جديد",
        ],
      };
    }

    // 5. Track Order Intent
    if (
      lowerText.includes("تتبع") ||
      lowerText.includes("فين الأوردر") ||
      lowerText.includes("أين الشحنة") ||
      lowerText.includes("track")
    ) {
      const words = cleanText.split(/\s+/);
      const identifier = words.find((w) => w.length >= 8 && !["تتبع", "الشحنة", "أوردر", "الاوردر"].includes(w)) ||
        extractEgyptianPhoneNumber(cleanText) ||
        words[words.length - 1];

      const trackRes = await executeMcpTool("track_order", { identifier }, customSupabase);
      if (!trackRes.found) {
        return {
          id: messageId,
          sender: "copilot",
          text: `🔍 لم يتم العثور على أوردر برقم أو كود: **${identifier}**.\nتأكد من كتابة كود الأوردر أو رقم هاتف العميل بشكل صحيح.`,
          timestamp: now,
          actionType: "info",
          suggestedPrompts: ["تتبع 01012345678", "📊 مؤشرات المتجر"],
        };
      }

      const statusMap: Record<string, string> = {
        new: "جديد (قيد التجهيز)",
        handed_to_carrier: "تم التسليم لشركة الشحن ومعه المندوب 🚚",
        delivered: "تم التسليم للعميل بنجاح ✅",
        returned: "مرتجع 🚨",
      };

      const statusText = statusMap[trackRes.delivery_status] || trackRes.delivery_status;

      return {
        id: messageId,
        sender: "copilot",
        text: `📦 **بيانات تتبع الشحنة #${trackRes.order_id.slice(0, 8)}:**\n\n• **العميل:** ${trackRes.customer_name}\n• **المحافظة:** ${trackRes.governorate}\n• **الحالة الحالية:** **${statusText}**\n• **المطلوب تحصيله:** ${trackRes.cod_amount} ج\n• **رابط التتبع للعميل:** [فتح صفحة التتبع](${trackRes.tracking_url})`,
        timestamp: now,
        actionType: "tracking",
        card: {
          type: "tracking",
          title: `🚚 تتبع الشحنة #${trackRes.order_id.slice(0, 8)}`,
          data: trackRes,
          primaryAction: {
            label: "فتح صفحة التتبع العامة للعميل",
            href: trackRes.tracking_url,
          },
        },
        suggestedPrompts: [
          `افحص العميل ${trackRes.customer_name}`,
          "💰 مستحقات شركات الشحن",
        ],
      };
    }

    // 6. Return Rescue & Failed Delivery Intent
    if (
      lowerText.includes("مرتجع") ||
      lowerText.includes("أنقذ") ||
      lowerText.includes("انقذ") ||
      lowerText.includes("rescue") ||
      lowerText.includes("فشل تسليم")
    ) {
      const returnedRes = await executeMcpTool("list_orders", { delivery_status: "returned", limit: 3 }, customSupabase);
      const orders = returnedRes.orders || [];

      let rescueAdvice = `🚨 **استراتيجية إنقاذ المرتجعات وتفادي غرامات الشحن:**\n\n`;
      if (orders.length > 0) {
        rescueAdvice += `يوجد حالياً **${orders.length} شحنات مرتجعة** يمكنك إنقاذها بالتواصل الفوري عبر واتساب:\n`;
        orders.forEach((o: any) => {
          rescueAdvice += `• **${o.customer_name}** (${o.phone_primary}) - ${o.governorate} - مبلغ ${o.cod_amount} ج\n`;
        });
      } else {
        rescueAdvice += `ممتاز! لا توجد شحنات مرتجعة حالياً مسجلة بالنظام 🎉.\n`;
      }

      rescueAdvice += `\n💬 **صيغة رسالة واتساب مقترحة للإنقاذ:**\n> *"مساء الخير يا فندم، بخصوص طلبك من متجرنا، مندوب الشحن بلغنا إنه واجه صعوبة في التواصل معاك. أوردرك جاهز ومحجوز لحضرتك، تحب نحدد موعد استلام مناسب بكرة مع خصم 20 ج على مصاريف الشحن؟"*`;

      return {
        id: messageId,
        sender: "copilot",
        text: rescueAdvice,
        timestamp: now,
        actionType: "rescue",
        card: {
          type: "rescue",
          title: "🛡️ محرك إنقاذ الشحنات المرتجعة",
          data: { returnedOrders: orders },
          primaryAction: {
            label: "إدارة ومتابعة المرتجعات",
            href: "/orders?deliveryStatus=returned",
          },
        },
        suggestedPrompts: [
          "📊 مؤشرات أداء المتجر",
          "💰 مستحقاتي عند شركات الشحن",
        ],
      };
    }

    // 7. General Greetings / Falcon Help
    return {
      id: messageId,
      sender: "copilot",
      text: `أهلاً بك يا فندم! أنا **مساعد فلكون الذكي (Falcon Copilot)** 🦅.\n\nأنا هنا لمساعدتك في كل تفاصيل شحنك وتجارتك الإلكترونية:\n\n1. 💰 **مستحقات الشحن:** اسألني "ليا كام عند شركات الشحن؟"\n2. 🛡️ **فحص أمان العملاء:** اكتب "افحص 01012345678" لأكشف لك تاريخ المرتجعات وسوابق النصب.\n3. ⚡ **تسجيل الأوردرات بالعامية:** الصق رسالة العميل وسأقوم باستخراج البيانات وتسجيلها فوراً.\n4. 📦 **تتبع الشحنات:** اكتب "تتبع" مع كود الشحنة أو رقم العميل.\n5. 📊 **نبض المتجر:** اسألني عن أداء الشحن ومعدل التسليم اليوم.\n\nبماذا تحب أن نبدأ؟`,
      timestamp: now,
      actionType: "info",
      suggestedPrompts: COPILOT_DEFAULT_PROMPTS,
    };
  } catch (error: any) {
    return {
      id: messageId,
      sender: "copilot",
      text: `عذراً يا فندم، حدث خطأ أثناء معالجة طلبك: ${error.message || "خطأ غير متوقع"}. حاول مرة أخرى.`,
      timestamp: now,
      actionType: "error",
      suggestedPrompts: COPILOT_DEFAULT_PROMPTS,
    };
  }
}
