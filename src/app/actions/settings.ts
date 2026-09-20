"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  FalconBrandingSettings,
  FalconCompanyInfoSettings,
  FalconWebhookSettings,
} from "@/types/database";

export interface AppSettingsBundle {
  branding: FalconBrandingSettings;
  companyInfo: FalconCompanyInfoSettings;
  webhook: FalconWebhookSettings;
}

const DEFAULT_BRANDING: FalconBrandingSettings = {
  company_name: "Falcon - فلكون",
  slogan: "شحن لوجستي سريع وموثوق",
  logo_url: null,
};

const DEFAULT_COMPANY_INFO: FalconCompanyInfoSettings = {
  sender_phone: "01000000000",
  return_address: "القاهرة - جمهورية مصر العربية",
  default_notes: "معاينة مسموحة قبل الاستلام",
};

const DEFAULT_WEBHOOK: FalconWebhookSettings = {
  webhook_url: "",
  webhook_secret: "",
  events_enabled: {
    order_created: true,
    order_delivered: true,
    order_settled: true,
  },
};

export async function getAppSettingsAction(): Promise<{
  success: boolean;
  data?: AppSettingsBundle;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["branding", "company_info", "webhook_config"]);

    if (error) {
      return { success: false, error: error.message };
    }

    const settingsMap: Record<string, unknown> = {};
    ((data as unknown as Array<{ key: string; value: unknown }>) || []).forEach((row) => {
      settingsMap[row.key] = row.value;
    });

    const branding = (settingsMap["branding"] as FalconBrandingSettings) || DEFAULT_BRANDING;
    const companyInfo = (settingsMap["company_info"] as FalconCompanyInfoSettings) || DEFAULT_COMPANY_INFO;
    const webhook = (settingsMap["webhook_config"] as FalconWebhookSettings) || DEFAULT_WEBHOOK;

    return {
      success: true,
      data: {
        branding: { ...DEFAULT_BRANDING, ...branding },
        companyInfo: { ...DEFAULT_COMPANY_INFO, ...companyInfo },
        webhook: { ...DEFAULT_WEBHOOK, ...webhook },
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "تعذر استرجاع الإعدادات";
    return { success: false, error: msg };
  }
}

export async function saveBrandingAction(
  branding: FalconBrandingSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await (supabase.from("app_settings") as any).upsert(
      {
        key: "branding",
        value: branding as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings");
    revalidatePath("/print/preview");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "فشل حفظ إعدادات الهوية";
    return { success: false, error: msg };
  }
}

export async function saveCompanyInfoAction(
  info: FalconCompanyInfoSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await (supabase.from("app_settings") as any).upsert(
      {
        key: "company_info",
        value: info as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings");
    revalidatePath("/orders/create");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "فشل حفظ بيانات المرسل";
    return { success: false, error: msg };
  }
}

export async function saveWebhookConfigAction(
  webhook: FalconWebhookSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await (supabase.from("app_settings") as any).upsert(
      {
        key: "webhook_config",
        value: webhook as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "فشل حفظ إعدادات الويب هوك";
    return { success: false, error: msg };
  }
}

export async function uploadLogoAction(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get("logo") as File | null;
    if (!file) {
      return { success: false, error: "لم يتم تحديد ملف للشعار" };
    }

    const ext = file.name.split(".").pop() || "png";
    const fileName = `falcon-logo-${Date.now()}.${ext}`;

    const supabase = await createClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("falcon-assets")
      .upload(fileName, buffer, {
        contentType: file.type || "image/png",
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: `فشل رفع الملف: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabase.storage
      .from("falcon-assets")
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // Automatically update branding settings with the new logo URL
    const { data: currentSettings } = await (supabase
      .from("app_settings") as any)
      .select("value")
      .eq("key", "branding")
      .maybeSingle();

    const existingBranding =
      ((currentSettings as any)?.value as FalconBrandingSettings) || DEFAULT_BRANDING;
    const updatedBranding: FalconBrandingSettings = {
      ...existingBranding,
      logo_url: publicUrl,
    };

    await (supabase.from("app_settings") as any).upsert(
      {
        key: "branding",
        value: updatedBranding as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    revalidatePath("/settings");
    revalidatePath("/print/preview");

    return { success: true, url: publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "فشل رفع الشعار";
    return { success: false, error: msg };
  }
}

export async function testWebhookAction(
  webhookUrl: string,
  secret?: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    if (!webhookUrl || !webhookUrl.startsWith("http")) {
      return { success: false, error: "رابط Webhook غير صالح" };
    }

    const payload = {
      event: "test.ping",
      timestamp: new Date().toISOString(),
      sender: "Falcon Operations Platform",
      data: {
        message: "اختبار اتصال Webhook من منصة فلكون للشحن",
        test_id: "test_" + Date.now(),
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Falcon-Webhook-Dispatcher/1.0",
    };

    if (secret) {
      headers["X-Falcon-Signature"] = secret;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    return {
      success: response.ok,
      status: response.status,
      error: response.ok ? undefined : `استجابة الخادم: ${response.status} ${response.statusText}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "تعذر إرسال إشارة الاختبار";
    return { success: false, error: msg };
  }
}
