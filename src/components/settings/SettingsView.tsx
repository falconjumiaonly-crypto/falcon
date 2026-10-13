"use client";

import { useState, useRef, useTransition } from "react";
import {
  Building2,
  Image as ImageIcon,
  Key,
  Webhook,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  UploadCloud,
  Send,
  Save,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Phone,
  MapPin,
  FileText,
  Truck,
  Plus,
  RotateCcw,
  Search,
  Bot,
  Sparkles,
  Terminal,
  Cpu,
} from "lucide-react";
import {
  AppSettingsBundle,
  saveBrandingAction,
  saveCompanyInfoAction,
  saveWebhookConfigAction,
  uploadLogoAction,
  testWebhookAction,
  testCarrierWebhookAction,
  saveShippingRatesAction,
  saveCarrierConfigsAction,
} from "@/app/actions/settings";
import { CarrierConfig, DEFAULT_CARRIER_CONFIGS } from "@/lib/carriers/carrierConfig";
import { DEFAULT_GOVERNORATES } from "@/lib/governorates";
import { GovernorateRate } from "@/types/database";

interface SettingsViewProps {
  initialSettings: AppSettingsBundle;
}

export function SettingsView({ initialSettings }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"branding" | "shipping" | "carriers" | "rates" | "api">("branding");

  // Carrier Fleet & Configurations State
  const [carrierConfigs, setCarrierConfigs] = useState<CarrierConfig[]>(
    initialSettings.carrierConfigs?.length ? initialSettings.carrierConfigs : DEFAULT_CARRIER_CONFIGS
  );
  const [isSavingCarriers, setIsSavingCarriers] = useState(false);
  const [showAddCarrier, setShowAddCarrier] = useState(false);
  const [newCarrierNameAr, setNewCarrierNameAr] = useState("");
  const [newCarrierNameEn, setNewCarrierNameEn] = useState("");
  const [newCarrierBaseCost, setNewCarrierBaseCost] = useState<number | "">(60);
  const [newCarrierDays, setNewCarrierDays] = useState<number | "">(2);
  const [newCarrierRate, setNewCarrierRate] = useState<number | "">(90);
  const [newCarrierPhone, setNewCarrierPhone] = useState("");
  const [newCarrierNotes, setNewCarrierNotes] = useState("");

  // Shipping Rates State
  const [shippingRates, setShippingRates] = useState<GovernorateRate[]>(
    initialSettings.shippingRates?.length ? initialSettings.shippingRates : DEFAULT_GOVERNORATES
  );
  const [govSearch, setGovSearch] = useState("");
  const [showAddGov, setShowAddGov] = useState(false);
  const [newGovName, setNewGovName] = useState("");
  const [newGovRate, setNewGovRate] = useState<number | "">("");
  const [newGovAliases, setNewGovAliases] = useState("");
  const [isSavingRates, setIsSavingRates] = useState(false);

  // Branding State
  const [branding, setBranding] = useState(initialSettings.branding);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialSettings.branding.logo_url);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Company Info State
  const [companyInfo, setCompanyInfo] = useState(initialSettings.companyInfo);

  // Webhook State
  const [webhook, setWebhook] = useState(initialSettings.webhook);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // API Key Display State
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const API_KEY = "falcon_sec_live_9f83a02bb4e1423c91a78e2d4099ce";

  // Transitions and Feedback
  const [isPending, startTransition] = useTransition();

  // Inbound Carrier Webhooks State
  const [testCarrier, setTestCarrier] = useState<"bosta" | "jnt" | "generic">("bosta");
  const [testTrackingCode, setTestTrackingCode] = useState("");
  const [testEventStatus, setTestEventStatus] = useState("Delivered");
  const [isTestingCarrierWebhook, setIsTestingCarrierWebhook] = useState(false);
  const [carrierTestResult, setCarrierTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [copiedCarrierWebhook, setCopiedCarrierWebhook] = useState<string | null>(null);

  const handleCopyCarrierWebhook = (url: string, carrierName: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCarrierWebhook(carrierName);
    setTimeout(() => setCopiedCarrierWebhook(null), 2500);
  };

  // Falcon MCP Server Integration State
  const [copiedMcpConfig, setCopiedMcpConfig] = useState(false);
  const [copiedMcpEndpoint, setCopiedMcpEndpoint] = useState(false);
  const [testingMcp, setTestingMcp] = useState(false);
  const [mcpTestResult, setMcpTestResult] = useState<{
    success: boolean;
    message: string;
    toolsCount?: number;
  } | null>(null);

  const handleTestMcp = async () => {
    setTestingMcp(true);
    setMcpTestResult(null);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        }),
      });
      const data = await res.json();
      if (data.result?.tools) {
        setMcpTestResult({
          success: true,
          message: `اتصال ناجح بنسبة 100%! خادم الـ MCP يعمل ومتاح للـ AI بعدد ${data.result.tools.length} أدوات فعالة.`,
          toolsCount: data.result.tools.length,
        });
      } else {
        setMcpTestResult({
          success: false,
          message: "استجابة غير متوقعة: " + JSON.stringify(data),
        });
      }
    } catch (err: any) {
      setMcpTestResult({
        success: false,
        message: "تعذر الاتصال بـ /api/mcp: " + (err.message || "خطأ غير متوقع"),
      });
    } finally {
      setTestingMcp(false);
    }
  };

  const handleRunCarrierTest = async () => {
    if (!testTrackingCode.trim()) {
      setCarrierTestResult({ success: false, message: "يرجى إدخال كود الأوردر أو رقم البوليصة لتجربة الاستقبال" });
      return;
    }
    setIsTestingCarrierWebhook(true);
    setCarrierTestResult(null);

    let payload: any = {};
    if (testCarrier === "bosta") {
      payload = {
        trackingNumber: testTrackingCode.trim(),
        state: testEventStatus,
        notes: "اختبار مباشر من لوحة إعدادات فلكون",
        updatedAt: new Date().toISOString(),
      };
    } else if (testCarrier === "jnt") {
      payload = {
        billCode: testTrackingCode.trim(),
        scanType: testEventStatus === "Delivered" ? "SIGN" : testEventStatus === "Returned" ? "RETURN" : "DELIVERING",
        scanDesc: "اختبار مباشر من لوحة إعدادات فلكون",
        scanTime: new Date().toISOString(),
      };
    } else {
      payload = {
        tracking_number: testTrackingCode.trim(),
        status: testEventStatus,
        notes: "اختبار مباشر من لوحة إعدادات فلكون",
      };
    }

    const res = await testCarrierWebhookAction(testCarrier, payload);
    setIsTestingCarrierWebhook(false);
    setCarrierTestResult({
      success: res.success,
      message: res.message,
    });
  };
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showStatus = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Handle Logo Upload
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (< 3MB)
    if (file.size > 3 * 1024 * 1024) {
      showStatus("error", "حجم الشعار يجب ألا يتجاوز 3 ميجابايت");
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await uploadLogoAction(formData);
      if (res.success && res.url) {
        setLogoPreview(res.url);
        setBranding((prev) => ({ ...prev, logo_url: res.url! }));
        showStatus("success", "تم رفع وتعيين شعار فلكون بنجاح!");
      } else {
        showStatus("error", res.error || "فشل رفع الشعار");
      }
    } catch {
      showStatus("error", "حدث خطأ غير متوقع أثناء رفع الشعار");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setBranding((prev) => ({ ...prev, logo_url: null }));
    startTransition(async () => {
      const res = await saveBrandingAction({ ...branding, logo_url: null });
      if (res.success) {
        showStatus("success", "تمت إزالة الشعار والعودة للنسق الافتراضي");
      } else {
        showStatus("error", res.error || "فشل حفظ التعديل");
      }
    });
  };

  const handleSaveBranding = () => {
    startTransition(async () => {
      const res = await saveBrandingAction(branding);
      if (res.success) {
        showStatus("success", "تم حفظ إعدادات الهوية والشعار بنجاح");
      } else {
        showStatus("error", res.error || "فشل حفظ إعدادات الهوية");
      }
    });
  };

  const handleSaveCompanyInfo = () => {
    startTransition(async () => {
      const res = await saveCompanyInfoAction(companyInfo);
      if (res.success) {
        showStatus("success", "تم حفظ بيانات المرسل وعنوان المرتجع بنجاح");
      } else {
        showStatus("error", res.error || "فشل حفظ بيانات المرسل");
      }
    });
  };

  const handleSaveWebhook = () => {
    startTransition(async () => {
      const res = await saveWebhookConfigAction(webhook);
      if (res.success) {
        showStatus("success", "تم حفظ إعدادات الويب هوك والتكامل بنجاح");
      } else {
        showStatus("error", res.error || "فشل حفظ إعدادات الويب هوك");
      }
    });
  };

  const handleTestWebhook = async () => {
    if (!webhook.webhook_url) {
      showStatus("error", "يرجى كتابة رابط Webhook أولاً لاختباره");
      return;
    }

    setTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      const res = await testWebhookAction(webhook.webhook_url, webhook.webhook_secret);
      if (res.success) {
        setWebhookTestResult({
          success: true,
          message: `تم إرسال إشارة الاختبار بنجاح (رمز الحالة: ${res.status})`,
        });
      } else {
        setWebhookTestResult({
          success: false,
          message: res.error || "فشل الاتصال برابط الويب هوك",
        });
      }
    } catch {
      setWebhookTestResult({
        success: false,
        message: "تعذر إرسال الطلب إلى الرابط المحدد",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(API_KEY);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Shipping Rates Handlers
  const handleRateChange = (name: string, rate: number) => {
    setShippingRates((prev) =>
      prev.map((g) => (g.name === name ? { ...g, rate: Math.max(0, rate) } : g))
    );
  };

  const handleAddGovernorate = () => {
    if (!newGovName.trim()) {
      showStatus("error", "يرجى كتابة اسم المحافظة أو المدينة");
      return;
    }
    if (newGovRate === "" || isNaN(Number(newGovRate)) || Number(newGovRate) < 0) {
      showStatus("error", "يرجى إدخال سعر شحن صالح");
      return;
    }

    const aliases = newGovAliases
      .split(/[,،]/)
      .map((a) => a.trim())
      .filter(Boolean);

    const exists = shippingRates.some(
      (g) => g.name.trim().toLowerCase() === newGovName.trim().toLowerCase()
    );

    if (exists) {
      showStatus("error", "هذه المحافظة مسجلة بالفعل، يمكنك تعديل سعرها مباشرة");
      return;
    }

    const newGov: GovernorateRate = {
      name: newGovName.trim(),
      rate: Number(newGovRate),
      aliases: aliases.length > 0 ? aliases : undefined,
    };

    setShippingRates((prev) => [...prev, newGov]);
    setNewGovName("");
    setNewGovRate("");
    setNewGovAliases("");
    setShowAddGov(false);
    showStatus("success", `تمت إضافة ${newGov.name} بنجاح`);
  };

  const handleRemoveGovernorate = (name: string) => {
    setShippingRates((prev) => prev.filter((g) => g.name !== name));
    showStatus("success", `تمت إزالة ${name}`);
  };

  const handleResetDefaultRates = () => {
    if (confirm("هل تريد استعادة قائمة المحافظات والأسعار الافتراضية؟")) {
      setShippingRates(DEFAULT_GOVERNORATES);
      showStatus("success", "تمت استعادة الأسعار الافتراضية (لا تنسَ الضغط على حفظ الأسعار)");
    }
  };

  const handleSaveShippingRates = async () => {
    setIsSavingRates(true);
    try {
      const res = await saveShippingRatesAction(shippingRates);
      if (res.success) {
        showStatus("success", "تم حفظ أسعار الشحن لكافة المحافظات بنجاح في قاعدة البيانات!");
      } else {
        showStatus("error", res.error || "فشل حفظ أسعار الشحن");
      }
    } catch {
      showStatus("error", "حدث خطأ أثناء حفظ أسعار الشحن");
    } finally {
      setIsSavingRates(false);
    }
  };

  const handleToggleCarrierActive = (id: string) => {
    setCarrierConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c))
    );
  };

  const handleUpdateCarrierField = (
    id: string,
    field: keyof CarrierConfig,
    value: any
  ) => {
    setCarrierConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveCarrier = (id: string) => {
    if (confirm("هل أنت متأكد من حذف شركة الشحن هذه؟")) {
      setCarrierConfigs((prev) => prev.filter((c) => c.id !== id));
      showStatus("success", "تم حذف شركة الشحن");
    }
  };

  const handleAddCustomCarrier = () => {
    if (!newCarrierNameAr.trim()) {
      showStatus("error", "يرجى إدخال اسم شركة الشحن بالعربية");
      return;
    }
    const id = "custom_" + Date.now().toString(36);
    const newCarrier: CarrierConfig = {
      id,
      nameAr: newCarrierNameAr.trim(),
      nameEn: newCarrierNameEn.trim() || newCarrierNameAr.trim(),
      isActive: true,
      baseCost: Number(newCarrierBaseCost) || 60,
      avgDeliveryDays: Number(newCarrierDays) || 2,
      expectedDeliveryRate: Number(newCarrierRate) || 90,
      supportPhone: newCarrierPhone.trim(),
      notes: newCarrierNotes.trim(),
      allowOpenPackage: true,
      isCustom: true,
    };
    setCarrierConfigs((prev) => [...prev, newCarrier]);
    setNewCarrierNameAr("");
    setNewCarrierNameEn("");
    setNewCarrierBaseCost(60);
    setNewCarrierDays(2);
    setNewCarrierRate(90);
    setNewCarrierPhone("");
    setNewCarrierNotes("");
    setShowAddCarrier(false);
    showStatus("success", `تمت إضافة شركة الشحن ${newCarrier.nameAr} بنجاح`);
  };

  const handleResetDefaultCarriers = () => {
    if (confirm("هل تريد استعادة شركات الشحن الافتراضية (بوسطة، J&T، أرامكس، مايلرز، شحن ذاتي)؟")) {
      setCarrierConfigs(DEFAULT_CARRIER_CONFIGS);
      showStatus("success", "تمت استعادة شركات الشحن الافتراضية (لا تنسَ الضغط على حفظ الشركات)");
    }
  };

  const handleSaveCarriers = async () => {
    setIsSavingCarriers(true);
    try {
      const res = await saveCarrierConfigsAction(carrierConfigs);
      if (res.success) {
        showStatus("success", "تم حفظ إعدادات شركات الشحن والمناديب بنجاح في قاعدة البيانات!");
      } else {
        showStatus("error", res.error || "فشل حفظ شركات الشحن");
      }
    } catch {
      showStatus("error", "حدث خطأ أثناء حفظ شركات الشحن");
    } finally {
      setIsSavingCarriers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            الإعدادات والتكاملات
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            إدارة هوية شركة فلكون، الشعار المطبوع، شركات الشحن والمناديب، وأسعار المحافظات.
          </p>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-rose-50 text-rose-800 border-rose-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("branding")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "branding"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>هوية الشركة والشعار</span>
        </button>

        <button
          onClick={() => setActiveTab("carriers")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "carriers"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>شركات الشحن والمناديب</span>
        </button>

        <button
          onClick={() => setActiveTab("shipping")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "shipping"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>بيانات المرسل والمرتجع</span>
        </button>

        <button
          onClick={() => setActiveTab("rates")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === "rates"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>أسعار شحن المحافظات</span>
        </button>

        <button
          onClick={() => setActiveTab("api")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            activeTab === "api"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>مفاتيح التكامل والأتمتة (API)</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: BRANDING & LOGO                                     */}
      {/* ========================================================= */}
      {activeTab === "branding" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b pb-3">
              تخصيص الهوية البصرية
            </h2>

            {/* Logo Uploader */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                شعار الشركة المطبوع (Falcon Logo)
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
                {/* Logo Preview Box */}
                <div className="w-24 h-24 rounded-xl border border-slate-200 bg-white flex items-center justify-center p-2 shadow-inner shrink-0">
                  {uploadingLogo ? (
                    <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                  ) : logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt="Falcon Logo"
                      className="max-h-full max-w-full object-contain grayscale"
                    />
                  ) : (
                    <span className="text-3xl">🦅</span>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-right space-y-2">
                  <div className="text-xs text-slate-500">
                    يدعم ملفات PNG, JPG, WebP أو SVG. يوصى بصورة مفرغة بخلفية شفافة لطباعة نقية
                    عالية التباين (أبيض وأسود).
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoFileChange}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>{uploadingLogo ? "جاري الرفع..." : "رفع شعار جديد"}</span>
                    </button>

                    {logoPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={isPending}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all border border-rose-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>استعادة الشعار الافتراضي</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الشركة (بالعربية أو الإنجليزية)
                </label>
                <input
                  type="text"
                  value={branding.company_name}
                  onChange={(e) =>
                    setBranding((prev) => ({ ...prev, company_name: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="فلكون"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الشعار اللفظي / الوصف
                </label>
                <input
                  type="text"
                  value={branding.slogan}
                  onChange={(e) =>
                    setBranding((prev) => ({ ...prev, slogan: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="شحن لوجستي سريع وموثوق"
                />
              </div>
            </div>

            <div className="pt-2 border-t flex justify-end">
              <button
                type="button"
                onClick={handleSaveBranding}
                disabled={isPending}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isPending ? "جاري الحفظ..." : "حفظ التغييرات"}</span>
              </button>
            </div>
          </div>

          {/* Live Label Preview */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  معاينة حية على ترويسة البوليصة
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                هكذا سيظهر الشعار والاسم أعلى كل بوليصة شحن مطبوعة بحجم A4:
              </p>

              {/* Mock Label Header */}
              <div className="bg-white border-2 border-black rounded-lg p-3 text-black">
                <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoPreview || "/falcon-logo.png"}
                      alt="فلكون"
                      className="h-8 w-auto object-contain"
                    />
                    <div>
                      <span className="text-sm font-black tracking-tight leading-none block">
                        {branding.company_name || "فلكون"}
                      </span>
                    </div>
                  </div>

                  <div className="text-left" dir="ltr">
                    <span className="text-[9px] font-bold block text-black">
                      {new Date().toISOString().split("T")[0]}
                    </span>
                    <span className="text-[8px] font-mono text-black font-bold block">
                      #FLC-DEMO
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 text-center py-2 border border-dashed border-slate-300 rounded">
                  [ محتوى بوليصة الشحن وبيانات العميل ]
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">ملاحظة الطباعة:</span> الشعار يطبع
              دائماً بتدرج الرمادي والأبيض والأسود النقي لتوافق كامل مع طابعات الليزر والحرارية.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: SHIPPING & SENDER INFO                              */}
      {/* ========================================================= */}
      {activeTab === "shipping" && (
        <div className="max-w-3xl bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-3">
            بيانات المرسل وعنوان المرتجعات الافتراضي
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>رقم هاتف الراسل / خدمة العملاء</span>
              </label>
              <input
                type="text"
                dir="ltr"
                value={companyInfo.sender_phone}
                onChange={(e) =>
                  setCompanyInfo((prev) => ({ ...prev, sender_phone: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="01000000000"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                الرقم الذي يظهر لشركة الشحن ومندوب التوصيل في حال تعذر الوصول للعميل.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>عنوان المرتجعات والمخزن الرئيسي</span>
              </label>
              <input
                type="text"
                value={companyInfo.return_address}
                onChange={(e) =>
                  setCompanyInfo((prev) => ({ ...prev, return_address: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="القاهرة - جمهورية مصر العربية"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                العنوان الذي ترجع إليه الطرود المرتجعة من قبل شركة الشحن.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>ملاحظات المندوب التلقائية (الافتراضية للشحنات الجديدة)</span>
              </label>
              <input
                type="text"
                value={companyInfo.default_notes}
                onChange={(e) =>
                  setCompanyInfo((prev) => ({ ...prev, default_notes: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="معاينة مسموحة قبل الاستلام"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                يتم إدراج هذه الملاحظة تلقائياً في خانة الملاحظات عند إنشاء طلب جديد ما لم يقم
                المستخدم بتعديلها.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t flex justify-end">
            <button
              type="button"
              onClick={handleSaveCompanyInfo}
              disabled={isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isPending ? "جاري الحفظ..." : "حفظ بيانات المرسل"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: API & AUTOMATION                                   */}
      {/* ========================================================= */}
      {activeTab === "api" && (
        <div className="space-y-6">
          {/* API Key Box */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-500" />
                  <span>مفتاح أتمتة فلكون (Automation API Key)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  استخدم هذا المفتاح السري لتوثيق جميع طلبات الأتمتة الواردة من Make.com و n8n.
                </p>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>بيئة الإنتاج المباشرة (Live)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-xl font-mono text-xs text-white">
              <span className="flex-1 select-all overflow-x-auto py-1">
                {showApiKey ? API_KEY : "falcon_sec_live_••••••••••••••••••••••••••••••"}
              </span>

              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                title={showApiKey ? "إخفاء المفتاح" : "إظهار المفتاح"}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleCopyKey}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-1.5 text-xs font-sans font-bold"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? "تم النسخ!" : "نسخ المفتاح"}</span>
              </button>
            </div>

            {/* Endpoints Cheatsheet */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-slate-800 block">
                عناوين API الجاهزة للأتمتة (Make.com & n8n Endpoints):
              </span>
              <ul className="space-y-1.5 font-mono text-[11px] text-slate-600">
                <li className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                    POST
                  </span>
                  <span>/api/v1/orders</span>
                  <span className="text-slate-400 font-sans">(إنشاء طلب جديد مع Idempotency)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                    POST
                  </span>
                  <span>/api/v1/orders/bulk</span>
                  <span className="text-slate-400 font-sans">(إنشاء دفعات طلبات متعددة)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">
                    GET
                  </span>
                  <span>/api/v1/orders</span>
                  <span className="text-slate-400 font-sans">(استعلام وقوائم الطلبات المصفاة)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">
                    PATCH
                  </span>
                  <span>/api/v1/orders/:id</span>
                  <span className="text-slate-400 font-sans">(تحديث الطلب وحالة التسليم)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Webhook Configuration */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-purple-600" />
                  <span>الويب هوك الصادر (Outgoing Webhooks)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  إرسال إشعارات فورية إلى سيناريوهات Make.com أو n8n عند حدوث تغييرات على الطلبات.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رابط الاستقبال (Target Webhook URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    dir="ltr"
                    value={webhook.webhook_url}
                    onChange={(e) =>
                      setWebhook((prev) => ({ ...prev, webhook_url: e.target.value }))
                    }
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="https://hook.eu1.make.com/xxxxxxxxxxxxxxxxxxxx"
                  />

                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={testingWebhook || !webhook.webhook_url}
                    className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    {testingWebhook ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{testingWebhook ? "جاري الإرسال..." : "إرسال تجربة (Ping)"}</span>
                  </button>
                </div>
              </div>

              {/* Webhook Test Feedback */}
              {webhookTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    webhookTestResult.success
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-rose-50 text-rose-800 border-rose-300"
                  }`}
                >
                  {webhookTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{webhookTestResult.message}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المفتاح السري للتوقيع (Webhook Secret) - اختياري
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={webhook.webhook_secret}
                  onChange={(e) =>
                    setWebhook((prev) => ({ ...prev, webhook_secret: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="whsec_xxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              {/* Enabled Events */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2">
                  الأحداث المفعلة للإرسال التلقائي:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={webhook.events_enabled.order_created}
                      onChange={(e) =>
                        setWebhook((prev) => ({
                          ...prev,
                          events_enabled: {
                            ...prev.events_enabled,
                            order_created: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-800">إنشاء طلب جديد</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={webhook.events_enabled.order_delivered}
                      onChange={(e) =>
                        setWebhook((prev) => ({
                          ...prev,
                          events_enabled: {
                            ...prev.events_enabled,
                            order_delivered: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-800">تسليم الشحنة للعميل</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={webhook.events_enabled.order_settled}
                      onChange={(e) =>
                        setWebhook((prev) => ({
                          ...prev,
                          events_enabled: {
                            ...prev.events_enabled,
                            order_settled: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-800">تسوية التحصيل المالي</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                type="button"
                onClick={handleSaveWebhook}
                disabled={isPending}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isPending ? "جاري الحفظ..." : "حفظ إعدادات الويب هوك"}</span>
              </button>
            </div>
          </div>

          {/* Carrier Webhook Listeners & Live Tracking Sync Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-600" />
                  <span>روابط استقبال تحديثات شركات الشحن (Inbound Carrier Webhooks)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  انسخ الرابط الخاص بشركة الشحن والصقه في لوحة تحكم حسابك لدى بوسطة أو J&T لتحديث حالات الشحنات والتسليم والمرتجعات لحظياً!
                </p>
              </div>

              <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-full w-max flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>المستقبلات مفعلة وشغالة</span>
              </span>
            </div>

            {/* Carrier Webhook URL Endpoints Grid */}
            <div className="space-y-3">
              {/* Bosta */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">شركة بوسطة (Bosta Webhook):</span>
                    <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">بوسطة مصر</span>
                  </div>
                  <div className="font-mono text-xs text-slate-600 break-all select-all">
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/carrier/bosta
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCarrierWebhook(
                      `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/carrier/bosta`,
                      "bosta"
                    )
                  }
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  {copiedCarrierWebhook === "bosta" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCarrierWebhook === "bosta" ? "تم النسخ!" : "نسخ الرابط"}</span>
                </button>
              </div>

              {/* J&T Express */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">شركة J&T Express (J&T Webhook):</span>
                    <span className="px-1.5 py-0.2 bg-red-100 text-red-800 rounded text-[10px] font-bold">J&T مصر</span>
                  </div>
                  <div className="font-mono text-xs text-slate-600 break-all select-all">
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/carrier/jnt
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCarrierWebhook(
                      `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/carrier/jnt`,
                      "jnt"
                    )
                  }
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  {copiedCarrierWebhook === "jnt" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCarrierWebhook === "jnt" ? "تم النسخ!" : "نسخ الرابط"}</span>
                </button>
              </div>

              {/* Generic Courier */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">شركة شحن مخصصة / أرامكس (Generic Webhook):</span>
                    <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">عام</span>
                  </div>
                  <div className="font-mono text-xs text-slate-600 break-all select-all">
                    {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/carrier/generic
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyCarrierWebhook(
                      `${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/carrier/generic`,
                      "generic"
                    )
                  }
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  {copiedCarrierWebhook === "generic" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCarrierWebhook === "generic" ? "تم النسخ!" : "نسخ الرابط"}</span>
                </button>
              </div>
            </div>

            {/* Inbound Webhook Live Simulator */}
            <div className="mt-4 p-4 border border-blue-200 rounded-xl bg-blue-50/30 space-y-3">
              <span className="font-bold text-xs text-blue-950 block">
                محاكي اختبار استقبال تحديث شركة الشحن (Carrier Webhook Simulator):
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">شركة الشحن:</label>
                  <select
                    value={testCarrier}
                    onChange={(e) => setTestCarrier(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-medium"
                  >
                    <option value="bosta">بوسطة (Bosta)</option>
                    <option value="jnt">جي آند تي (J&T Express)</option>
                    <option value="generic">شركة مخصصة (Generic)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">كود الأوردر أو رقم البوليصة:</label>
                  <input
                    type="text"
                    value={testTrackingCode}
                    onChange={(e) => setTestTrackingCode(e.target.value)}
                    placeholder="مثال: #A1B2C3D4 أو 01012345678"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الحالة المراد محاكاتها:</label>
                  <select
                    value={testEventStatus}
                    onChange={(e) => setTestEventStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-medium"
                  >
                    <option value="Delivered">تم التسليم للعميل (Delivered)</option>
                    <option value="Out for delivery">خرج للتوصيل مع المندوب</option>
                    <option value="Returned">طرد مرتجع (Returned)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500">
                  يقوم المحاكي بتطبيق نفس منطق معالجة الويب هوك وتحديث الأوردر وملاحظاته وسجل التتبع فوراً.
                </span>

                <button
                  type="button"
                  onClick={handleRunCarrierTest}
                  disabled={isTestingCarrierWebhook || !testTrackingCode.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isTestingCarrierWebhook ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>إرسال إشارة الويب هوك</span>
                </button>
              </div>

              {carrierTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                    carrierTestResult.success
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : "bg-rose-50 text-rose-800 border-rose-300"
                  }`}
                >
                  {carrierTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{carrierTestResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Model Context Protocol (MCP) AI Integration Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-600" />
                  <span>خادم الذكاء الاصطناعي (Falcon MCP Server)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  اربط نظام Falcon Shipping بنماذج الذكاء الاصطناعي (Claude Desktop, Antigravity, Cursor) لتطلب منها بالعامية الاستعلام عن الأوردرات، إنشاء شحنات، وحساب ديون الشحن!
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                  <span>MCP 2024-11-05 Ready</span>
                </span>
              </div>
            </div>

            {/* MCP Config Presets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Local Stdio MCP */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-900">
                      1. الربط المكتبي المحلي (Local Stdio Server)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const snippet = JSON.stringify(
                        {
                          mcpServers: {
                            "falcon-shipping": {
                              command: "node",
                              args: ["d:/~/DAWNLOADS/falcon shiping/mcp/server.mjs"],
                            },
                          },
                        },
                        null,
                        2
                      );
                      navigator.clipboard.writeText(snippet);
                      setCopiedMcpConfig(true);
                      setTimeout(() => setCopiedMcpConfig(false), 2500);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    {copiedMcpConfig ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ كود الإعداد</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  أضف هذا الكود في ملف <code className="text-indigo-600 font-mono font-bold">mcp_config.json</code> أو <code className="text-indigo-600 font-mono font-bold">claude_desktop_config.json</code> للربط المباشر الفوري.
                </p>
                <pre className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto text-left" dir="ltr">
{`"falcon-shipping": {
  "command": "node",
  "args": ["d:/~/DAWNLOADS/falcon shiping/mcp/server.mjs"]
}`}
                </pre>
              </div>

              {/* Remote WebMCP HTTP */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-900">
                      2. رابط الـ WebMCP السحابي (HTTP Endpoint)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const url = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "http://localhost:3000/api/mcp";
                      navigator.clipboard.writeText(url);
                      setCopiedMcpEndpoint(true);
                      setTimeout(() => setCopiedMcpEndpoint(false), 2500);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    {copiedMcpEndpoint ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ رابط الـ Endpoint</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  نقطة اتصال HTTP JSON-RPC قياسية لوكلاء الذكاء الاصطناعي عبر الويب أو السيرفرات السحابية.
                </p>
                <div className="p-2.5 bg-white border border-slate-200 font-mono text-xs rounded-lg text-slate-800 flex items-center justify-between" dir="ltr">
                  <span className="truncate">/api/mcp</span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">POST (JSON-RPC 2.0)</span>
                </div>
              </div>
            </div>

            {/* MCP Capabilities & Exposed Tools */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                الأدوات المتاحة لنماذج الذكاء الاصطناعي (8 Active AI Tools):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <code className="text-indigo-600 font-bold block">get_store_kpis</code>
                  <span className="text-[10px] text-slate-500">إحصائيات المتجر والتحصيلات</span>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <code className="text-indigo-600 font-bold block">list_orders</code>
                  <span className="text-[10px] text-slate-500">البحث والفلترة في الشحنات</span>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <code className="text-indigo-600 font-bold block">create_order</code>
                  <span className="text-[10px] text-slate-500">إنشاء أوردر بالعامية أو مفصل</span>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <code className="text-indigo-600 font-bold block">get_courier_dues</code>
                  <span className="text-[10px] text-slate-500">رادار ديون ومستحقات الشحن</span>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <code className="text-indigo-600 font-bold block">check_customer_risk</code>
                  <span className="text-[10px] text-slate-500">كشف العملاء النصابين والمرتجعات</span>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <code className="text-indigo-600 font-bold block">track_order</code>
                  <span className="text-[10px] text-slate-500">تتبع الشحنة والخط الزمني</span>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <code className="text-indigo-600 font-bold block">parse_order_text</code>
                  <span className="text-[10px] text-slate-500">المحلل الذكي لرسائل العملاء</span>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <code className="text-indigo-600 font-bold block">update_order_status</code>
                  <span className="text-[10px] text-slate-500">تحديث حالة الشحنة مع التدقيق</span>
                </div>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                يمكنك اختبار جاهزية السيرفر واستجابة دواله فوراً:
              </span>

              <button
                type="button"
                onClick={handleTestMcp}
                disabled={testingMcp}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {testingMcp ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>اختبار اتصال خادم الـ MCP الآن</span>
              </button>
            </div>

            {mcpTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                  mcpTestResult.success
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-rose-50 text-rose-800 border-rose-300"
                }`}
              >
                {mcpTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{mcpTestResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB: CARRIERS & FLEET MANAGEMENT                          */}
      {/* ========================================================= */}
      {activeTab === "carriers" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <span>إدارة شركات الشحن والمناديب (Carriers Fleet)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                التحكم في شركات الشحن النشطة، تعديل الأسعار الأساسية، نسب التسليم المتوقعة، ومفاتيح التكامل وأرقام المتابعة.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddCarrier((prev) => !prev)}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-blue-200"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة شركة شحن جديدة</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaultCarriers}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="استعادة الشركات الخمس الافتراضية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الافتراضي</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCarriers}
                disabled={isSavingCarriers}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSavingCarriers ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ شركات الشحن</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Add Carrier Form */}
          {showAddCarrier && (
            <div className="bg-blue-50/70 border border-blue-200 p-5 rounded-2xl space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>إضافة شركة شحن أو مندوب خاص جديد</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddCarrier(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم الشركة (بالعربية) *</label>
                  <input
                    type="text"
                    value={newCarrierNameAr}
                    onChange={(e) => setNewCarrierNameAr(e.target.value)}
                    placeholder="مثال: رابيدو إكسبريس أو مندوب أحمد"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:outline-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم الشركة (بالإنجليزية)</label>
                  <input
                    type="text"
                    value={newCarrierNameEn}
                    onChange={(e) => setNewCarrierNameEn(e.target.value)}
                    placeholder="مثال: Rapido Express"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:outline-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعر الشحن الأساسي (ج.م)</label>
                  <input
                    type="number"
                    value={newCarrierBaseCost}
                    onChange={(e) => setNewCarrierBaseCost(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="60"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-blue-700 focus:outline-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">مدة التوصيل (أيام)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newCarrierDays}
                    onChange={(e) => setNewCarrierDays(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="2"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:outline-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نسبة التسليم المتوقعة (%)</label>
                  <input
                    type="number"
                    value={newCarrierRate}
                    onChange={(e) => setNewCarrierRate(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="90"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:outline-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم خدمة العملاء / المندوب</label>
                  <input
                    type="text"
                    value={newCarrierPhone}
                    onChange={(e) => setNewCarrierPhone(e.target.value)}
                    placeholder="01012345678 أو الخط الساخن"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:outline-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">ملاحظات ومناطق التغطية</label>
                  <input
                    type="text"
                    value={newCarrierNotes}
                    onChange={(e) => setNewCarrierNotes(e.target.value)}
                    placeholder="مثال: يغطي الجيزة وأكتوبر، تسليم خلال 24 ساعة"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:outline-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-blue-200">
                <button
                  type="button"
                  onClick={() => setShowAddCarrier(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomCarrier}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm"
                >
                  إضافة الشركة للأسطول
                </button>
              </div>
            </div>
          )}

          {/* Carriers Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {carrierConfigs.map((carrier) => (
              <div
                key={carrier.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  carrier.isActive
                    ? "bg-white border-slate-200 shadow-sm hover:border-blue-300"
                    : "bg-slate-50/70 border-slate-200 opacity-75"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                        carrier.isActive
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      🚚
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={carrier.nameAr}
                          onChange={(e) =>
                            handleUpdateCarrierField(carrier.id, "nameAr", e.target.value)
                          }
                          className="font-bold text-slate-900 text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none"
                        />
                        {carrier.isCustom && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold">
                            مخصصة
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {carrier.nameEn || carrier.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleCarrierActive(carrier.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        carrier.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          carrier.isActive ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      ></span>
                      <span>{carrier.isActive ? "مفعلة بالمنظومة" : "معطلة"}</span>
                    </button>

                    {carrier.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCarrier(carrier.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="حذف هذه الشركة المخصصة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      سعر الشحن (ج.م)
                    </label>
                    <input
                      type="number"
                      value={carrier.baseCost}
                      onChange={(e) =>
                        handleUpdateCarrierField(
                          carrier.id,
                          "baseCost",
                          Number(e.target.value) || 0
                        )
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-blue-700 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      مدة التوصيل (يوم)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={carrier.avgDeliveryDays}
                      onChange={(e) =>
                        handleUpdateCarrierField(
                          carrier.id,
                          "avgDeliveryDays",
                          Number(e.target.value) || 1
                        )
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      نسبة التسليم (%)
                    </label>
                    <input
                      type="number"
                      value={carrier.expectedDeliveryRate}
                      onChange={(e) =>
                        handleUpdateCarrierField(
                          carrier.id,
                          "expectedDeliveryRate",
                          Number(e.target.value) || 0
                        )
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Account & Support */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      كود العقد / رقم الحساب
                    </label>
                    <input
                      type="text"
                      value={carrier.merchantAccountId || ""}
                      onChange={(e) =>
                        handleUpdateCarrierField(
                          carrier.id,
                          "merchantAccountId",
                          e.target.value
                        )
                      }
                      placeholder="كود الحساب في الشركة"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      هاتف المندوب / الخط الساخن
                    </label>
                    <input
                      type="text"
                      value={carrier.supportPhone || ""}
                      onChange={(e) =>
                        handleUpdateCarrierField(
                          carrier.id,
                          "supportPhone",
                          e.target.value
                        )
                      }
                      placeholder="19xxx أو 01xxxx"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* API Key / Token */}
                <div className="text-xs">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    مفتاح الربط البرمجي (API Key / Token)
                  </label>
                  <input
                    type="password"
                    value={carrier.apiKey || ""}
                    onChange={(e) =>
                      handleUpdateCarrierField(carrier.id, "apiKey", e.target.value)
                    }
                    placeholder="مفتاح الـ API للربط المباشر مع بوابة الشركة"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Open package & Notes */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={carrier.allowOpenPackage}
                      onChange={(e) =>
                        handleUpdateCarrierField(
                          carrier.id,
                          "allowOpenPackage",
                          e.target.checked
                        )
                      }
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>السماح بفتح الشحنة والمعاينة</span>
                  </label>

                  <span className="text-[11px] text-slate-400 truncate max-w-[200px]" title={carrier.notes}>
                    {carrier.notes || "لا توجد ملاحظات إضافية"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB: SHIPPING RATES                                       */}
      {/* ========================================================= */}
      {activeTab === "rates" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                أسعار الشحن الثابتة حسب المحافظة
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                حدد سعر الشحن لكل محافظة ليتم تطبيقه تلقائياً عند إنشاء الأوردرات أو استيرادها من Excel.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddGov((prev) => !prev)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة محافظة جديدة</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaultRates}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                title="استعادة الأسعار الافتراضية للـ 27 محافظة المصرية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الافتراضي</span>
              </button>

              <button
                type="button"
                onClick={handleSaveShippingRates}
                disabled={isSavingRates}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingRates ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ أسعار الشحن</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* New Governorate Form */}
          {showAddGov && (
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-blue-900">إضافة محافظة أو منطقة جديدة</h3>
                <button
                  type="button"
                  onClick={() => setShowAddGov(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم المحافظة / المدينة *
                  </label>
                  <input
                    type="text"
                    value={newGovName}
                    onChange={(e) => setNewGovName(e.target.value)}
                    placeholder="مثال: مطروح أو الشيخ زايد"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر الشحن (ج.م) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newGovRate}
                    onChange={(e) =>
                      setNewGovRate(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="75"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    أسماء ومرادفات شائعة (مفصولة بفاصلة)
                  </label>
                  <input
                    type="text"
                    value={newGovAliases}
                    onChange={(e) => setNewGovAliases(e.target.value)}
                    placeholder="مرسى مطروح, مطروح"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddGov(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleAddGovernorate}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  إضافة للقائمة
                </button>
              </div>
            </div>
          )}

          {/* Search Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={govSearch}
                onChange={(e) => setGovSearch(e.target.value)}
                placeholder="ابحث عن اسم محافظة أو مدينة..."
                className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <span className="text-xs text-slate-400">
              إجمالي المحافظات: {shippingRates.length}
            </span>
          </div>

          {/* Governorates Rates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shippingRates
              .filter(
                (g) =>
                  !govSearch ||
                  g.name.includes(govSearch) ||
                  g.aliases?.some((a) => a.includes(govSearch))
              )
              .map((g) => (
                <div
                  key={g.name}
                  className="p-3.5 bg-slate-50/60 hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {g.name}
                    </span>
                    {g.aliases && g.aliases.length > 0 && (
                      <span className="text-[10px] text-slate-400 block truncate" title={g.aliases.join("، ")}>
                        مطابقات: {g.aliases.slice(0, 3).join("، ")}
                        {g.aliases.length > 3 ? "..." : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative w-24">
                      <input
                        type="number"
                        min="0"
                        value={g.rate}
                        onChange={(e) =>
                          handleRateChange(g.name, Number(e.target.value))
                        }
                        className="w-full pl-7 pr-2 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                        ج.م
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveGovernorate(g.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="حذف المحافظة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button
              type="button"
              onClick={handleSaveShippingRates}
              disabled={isSavingRates}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {isSavingRates ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ أسعار الشحن في قاعدة البيانات</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
