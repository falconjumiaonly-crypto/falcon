import { getAppSettingsAction } from "@/app/actions/settings";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata = {
  title: "الإعدادات والتكاملات | فلكون Falcon",
  description: "إدارة هوية وشعار فلكون، إعدادات الطباعة، ومفاتيح تكامل Make.com و n8n",
};

export default async function SettingsPage() {
  const res = await getAppSettingsAction();

  const fallbackSettings = {
    branding: {
      company_name: "فلكون",
      slogan: "",
      logo_url: "/falcon-logo.png",
    },
    companyInfo: {
      sender_phone: "01000000000",
      return_address: "القاهرة - جمهورية مصر العربية",
      default_notes: "معاينة مسموحة قبل الاستلام",
    },
    webhook: {
      webhook_url: "",
      webhook_secret: "",
      events_enabled: {
        order_created: true,
        order_delivered: true,
        order_settled: true,
      },
    },
  };

  const settings = res.success && res.data ? res.data : fallbackSettings;

  return <SettingsView initialSettings={settings} />;
}
