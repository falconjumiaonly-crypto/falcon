import { Order } from "@/types/database";

export interface WhatsAppTemplateConfig {
  id: string;
  name: string;
  description: string;
  template: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplateConfig[] = [
  {
    id: "printed_packing",
    name: "إشعار طباعة وتجهيز الشحنة",
    description: "يُرسل للعميل فور طباعة البوليصة وبدء تجهيز الطرد في المخزن",
    template: `أهلاً {{customer_name}} 👋
تم تجهيز طلبك رقم #{{order_id}} بنجاح وجاري تغليفه لتسليمه لشركة الشحن.
💰 المبلغ المطلوب عند الاستلام: {{cod_amount}}
📍 العنوان المسجل: {{governorate}} - {{address}}

شكراً لتعاملك مع {{store_name}}! ✨`,
  },
  {
    id: "dispatched_carrier",
    name: "إشعار خروج الشحنة مع المندوب",
    description: "يُرسل للعميل عند تسليم الشحنة لشركة الشحن أو خروجها في الطريق",
    template: `مرحباً {{customer_name}} 🚚
شحنتك رقم #{{order_id}} خرجت مع مندوب شركة الشحن ({{carrier_name}}).
سيتواصل معك المندوب قريباً على رقمك {{phone}} لتسليم الطرد.
💵 برجاء تجهيز المبلغ المطلوب: {{cod_amount}}

نتمنى لك تجربة تسوق مميزة! 📦
{{store_name}}`,
  },
  {
    id: "order_confirmation",
    name: "تأكيد تفاصيل الطلب قبل الشحن",
    description: "تأكيد العنوان والمبلغ مع العميل لتجنب رفض الاستلام",
    template: `أهلاً بك يا {{customer_name}} 🌸
نؤكد استلام طلبك رقم #{{order_id}} بإجمالي: {{order_total}}.
العنوان المسجل للشحن: {{governorate}} - {{address}}.
المبلغ عند الاستلام: {{cod_amount}}.

هل العنوان والتفاصيل صحيحة لتأكيد خروج الشحنة فوراً؟
{{store_name}}`,
  },
  {
    id: "delivery_reminder",
    name: "تذكير بالاستلام وتجهيز الكاش",
    description: "تذكير العميل صباح يوم التسليم لتجهيز الكاش والتواجد بالمنزل",
    template: `صباح الخير يا {{customer_name}} ☀️
مندوب شركة الشحن في طريقه إليك اليوم لتسليم شحنتك رقم #{{order_id}}.
برجاء التواجد وتجهيز مبلغ: {{cod_amount}}.
في حال وجود أي استفسار يسعدنا تواصلك معنا: {{support_phone}}.

{{store_name}}`,
  },
];

/**
 * Normalizes phone numbers to standard international format required by WhatsApp (wa.me).
 * Handles Egyptian phone variations (01xxxxxxxxx -> 201xxxxxxxxx).
 */
export function normalizePhoneForWhatsApp(rawPhone: unknown): string {
  if (!rawPhone) return "";
  let clean = String(rawPhone)
    .replace(/[^0-9]/g, "")
    .trim();

  if (!clean) return "";

  // Remove leading zeros if in 0020 format
  if (clean.startsWith("00")) {
    clean = clean.slice(2);
  }

  // Egyptian numbers: starts with 01x (11 digits)
  if (clean.startsWith("01") && clean.length === 11) {
    clean = "2" + clean;
  } else if (clean.startsWith("1") && clean.length === 10) {
    // 10xxxxxxxx -> 2010xxxxxxxx
    clean = "20" + clean;
  }

  return clean;
}

export interface TemplateExtraValues {
  storeName?: string;
  carrierName?: string;
  supportPhone?: string;
  trackingLink?: string;
}

/**
 * Interpolates variables within a WhatsApp message template with actual order data.
 */
export function interpolateWhatsAppTemplate(
  template: string,
  order: Order,
  extra?: TemplateExtraValues
): string {
  if (!template) return "";

  const shortId = order.id ? order.id.slice(0, 8).toUpperCase() : "";
  const codStr = `${Number(order.cod_amount || 0)} ج.م`;
  const totalStr = `${Number(order.order_total || 0)} ج.م`;
  const trackingLink =
    extra?.trackingLink ||
    (order.id ? `https://falcon-shipping.vercel.app/track/${order.id.slice(0, 8).toLowerCase()}` : "");

  return template
    .replace(/{{customer_name}}/g, order.customer_name || "عميلنا العزيز")
    .replace(/{{order_id}}/g, shortId)
    .replace(/{{cod_amount}}/g, codStr)
    .replace(/{{order_total}}/g, totalStr)
    .replace(/{{governorate}}/g, order.governorate || "")
    .replace(/{{address}}/g, order.address || "")
    .replace(/{{phone}}/g, order.phone_primary || "")
    .replace(/{{store_name}}/g, extra?.storeName || "فلكون شيبنج")
    .replace(/{{carrier_name}}/g, extra?.carrierName || "شركة الشحن")
    .replace(/{{support_phone}}/g, extra?.supportPhone || "")
    .replace(/{{tracking_link}}/g, trackingLink);
}

/**
 * Generates direct wa.me link for sending WhatsApp message to customer.
 */
export function generateWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = normalizePhoneForWhatsApp(phone);
  if (!cleanPhone) return "";
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates WhatsApp Web link for desktop browser users.
 */
export function generateWhatsAppWebUrl(phone: string, message: string): string {
  const cleanPhone = normalizePhoneForWhatsApp(phone);
  if (!cleanPhone) return "";
  return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
}
