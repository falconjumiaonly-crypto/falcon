"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  Printer,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Sparkles,
  Edit2,
  Trash2,
  Check,
  X,
  ShieldAlert,
  UserCheck,
  RotateCcw,
  EyeOff,
  Eye,
} from "lucide-react";
import { OrderInsert, GovernorateRate } from "@/types/database";
import { formatEgp, calculateCod, calculateNetProfit } from "@/lib/calculations";
import { DEFAULT_GOVERNORATES } from "@/lib/governorates";
import {
  detectColumnMappings,
  detectPlatformPreset,
  PLATFORM_PRESETS,
  validateImportRow,
  generateSampleExcelTemplate,
  FIELD_LABELS,
  ValidatedImportRow,
  detectIntraSheetDuplicates,
  classifyDbDuplicates,
  revalidateSingleRow,
  applyDuplicateResolutionStrategy,
  splitAndNormalizePhoneNumbers,
  DuplicateSeverity,
} from "@/lib/excel-import";
import {
  batchCreateOrdersAction,
  checkExistingPhoneDuplicatesAction,
} from "@/app/actions/orders";
import { getShippingRatesAction } from "@/app/actions/settings";

type Step = "upload" | "mapping" | "preview" | "complete";

export function ExcelImportWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shipping Rates
  const [shippingRates, setShippingRates] = useState<GovernorateRate[]>(DEFAULT_GOVERNORATES);

  // Wizard Step
  const [currentStep, setCurrentStep] = useState<Step>("upload");

  // Raw file & parsed data
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [detectedPreset, setDetectedPreset] = useState<string>("custom");

  // Validation results
  const [validatedRows, setValidatedRows] = useState<ValidatedImportRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<
    "all" | "valid" | "invalid" | "duplicate" | "excluded"
  >("all");
  const [isValidatingDuplicates, setIsValidatingDuplicates] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<
    "skip_all" | "skip_exact_only" | "import_all"
  >("skip_exact_only");

  // Inline editing state
  const [editingRowNumber, setEditingRowNumber] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<OrderInsert>>({});

  // Load configured shipping rates on mount
  useEffect(() => {
    getShippingRatesAction().then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        setShippingRates(res.data);
      }
    });
  }, []);

  // Import execution
  const [isPending, startTransition] = useTransition();
  const [importResult, setImportResult] = useState<{
    count: number;
    ids: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle Sample Template Download
  const handleDownloadTemplate = () => {
    const bytes = generateSampleExcelTemplate();
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "falcon_orders_template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle File Upload & Parse
  const handleFileUpload = (file: File) => {
    setError(null);
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("يرجى رفع ملف بصيغة Excel (.xlsx, .xls) أو .csv");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, {
          type: "binary",
          cellDates: true,
          raw: false, // Reads phone numbers with leading zeros as text!
        });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
          worksheet,
          { raw: false, defval: "" }
        );

        if (!jsonRows || jsonRows.length === 0) {
          setError("الملف فارغ أو لا يحتوي على أي صفوف قابلة للقراءة");
          return;
        }

        // Extract headers from first row
        const sheetHeaders = Object.keys(jsonRows[0]);
        setHeaders(sheetHeaders);
        setRawRows(jsonRows);

        // Auto-detect mappings & platform preset
        const detected = detectColumnMappings(sheetHeaders);
        setColumnMapping(detected);
        const presetInfo = detectPlatformPreset(sheetHeaders);
        setDetectedPreset(presetInfo.preset);

        setCurrentStep("mapping");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "خطأ غير معروف";
        setError("فشل تحليل ملف الإكسيل: " + msg);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Handle Governorates resolution for single row
  const handleResolveGovernorate = (rowNumber: number, selectedGovName: string) => {
    setValidatedRows((prev) =>
      prev.map((r) => {
        if (r.rowNumber !== rowNumber) return r;
        return revalidateSingleRow(r, { governorate: selectedGovName }, shippingRates);
      })
    );
  };

  // Inline editing handlers
  const handleStartEdit = (row: ValidatedImportRow) => {
    setEditingRowNumber(row.rowNumber);
    setEditDraft({
      customer_name:
        row.data?.customer_name || String(row.raw[columnMapping.customer_name] || ""),
      phone_primary:
        row.data?.phone_primary || String(row.raw[columnMapping.phone_primary] || ""),
      phone_secondary:
        row.data?.phone_secondary ||
        (row.raw[columnMapping.phone_secondary]
          ? String(row.raw[columnMapping.phone_secondary])
          : null),
      governorate: row.data?.governorate || row.governorateRaw || "",
      address: row.data?.address || String(row.raw[columnMapping.address] || ""),
      order_total:
        row.data?.order_total ?? (Number(row.raw[columnMapping.order_total]) || 0),
      paid_amount:
        row.data?.paid_amount ?? (Number(row.raw[columnMapping.paid_amount]) || 0),
      shipping_cost: row.data?.shipping_cost ?? 0,
      important_notes:
        row.data?.important_notes ||
        (row.raw[columnMapping.important_notes]
          ? String(row.raw[columnMapping.important_notes])
          : null),
    });
  };

  const handleCancelEdit = () => {
    setEditingRowNumber(null);
    setEditDraft({});
  };

  const handleSaveEdit = (rowNumber: number) => {
    setValidatedRows((prev) =>
      prev.map((r) => {
        if (r.rowNumber !== rowNumber) return r;
        return revalidateSingleRow(r, editDraft, shippingRates);
      })
    );
    setEditingRowNumber(null);
    setEditDraft({});
  };

  const handleToggleExcludeRow = (rowNumber: number) => {
    setValidatedRows((prev) =>
      prev.map((r) =>
        r.rowNumber === rowNumber ? { ...r, isExcluded: !r.isExcluded } : r
      )
    );
  };

  // Duplicate skip toggle for single row
  const handleToggleSkipDuplicate = (rowNumber: number) => {
    setValidatedRows((prev) =>
      prev.map((r) =>
        r.rowNumber === rowNumber ? { ...r, skipDuplicate: !r.skipDuplicate } : r
      )
    );
  };

  // Bulk duplicate resolution strategy
  const handleApplyDuplicateStrategy = (
    strategy: "skip_all" | "skip_exact_only" | "import_all"
  ) => {
    setDuplicateStrategy(strategy);
    setValidatedRows((prev) => applyDuplicateResolutionStrategy(prev, strategy));
  };

  // Proceed to Preview with Multi-Level Duplicate Checking
  const handleProceedToPreview = async () => {
    const required = [
      "customer_name",
      "phone_primary",
      "governorate",
      "address",
      "order_total",
    ];

    const missingRequired = required.filter((req) => !columnMapping[req]);
    if (missingRequired.length > 0) {
      setError(
        `يرجى مطابقة الأعمدة الإلزامية: ${missingRequired
          .map((m) => FIELD_LABELS[m])
          .join("، ")}`
      );
      return;
    }

    setIsValidatingDuplicates(true);
    setError(null);

    try {
      // 1. Initial row validation with loaded shippingRates
      const initialValidated = rawRows.map((row, idx) =>
        validateImportRow(row, columnMapping, idx + 1, shippingRates)
      );

      // 2. Intra-sheet duplicate detection
      let processed = detectIntraSheetDuplicates(initialValidated);

      // 3. Database existing duplicates check
      const phoneList = Array.from(
        new Set(
          processed
            .map((r) => r.data?.phone_primary)
            .filter((p): p is string => Boolean(p && p.length >= 7))
        )
      );

      if (phoneList.length > 0) {
        const dupRes = await checkExistingPhoneDuplicatesAction(phoneList);
        if (dupRes.success && dupRes.data) {
          processed = classifyDbDuplicates(processed, dupRes.data);
        }
      }

      // Default strategy: skip exact duplicates only, keep returning customers
      processed = applyDuplicateResolutionStrategy(processed, "skip_exact_only");

      setValidatedRows(processed);
      setEditingRowNumber(null);
      setEditDraft({});
      setCurrentStep("preview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
      setError("حدث خطأ أثناء فحص البيانات: " + msg);
    } finally {
      setIsValidatingDuplicates(false);
    }
  };

  // Execute Batch Import
  const handleExecuteImport = () => {
    const validOrders = validatedRows
      .filter((r) => !r.isExcluded && r.isValid && r.data !== null && !r.skipDuplicate)
      .map((r) => r.data as OrderInsert);

    if (validOrders.length === 0) {
      setError(
        "لا توجد أي صفوف صالحة ومحددة للاستيراد (قد تكون كافة الصفوف بها أخطاء أو تم تحديد تجاهلها أو استبعادها)"
      );
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await batchCreateOrdersAction(validOrders);
      if (res.success && res.data) {
        setImportResult(res.data);
        setCurrentStep("complete");
      } else {
        setError(res.error || "فشل إدراج الأوردرات في قاعدة البيانات");
      }
    });
  };

  // Filtered rows in Preview
  const nonExcludedRows = validatedRows.filter((r) => !r.isExcluded);
  const excludedRows = validatedRows.filter((r) => r.isExcluded);
  const validCount = nonExcludedRows.filter((r) => r.isValid).length;
  const invalidCount = nonExcludedRows.filter((r) => !r.isValid).length;
  const duplicateCount = nonExcludedRows.filter((r) => r.isDuplicate).length;
  const exactDuplicateCount = nonExcludedRows.filter(
    (r) =>
      r.isDuplicate &&
      (r.duplicateDetails?.severity === "exact_sheet" ||
        r.duplicateDetails?.severity === "exact_db")
  ).length;

  const toImportRows = nonExcludedRows.filter(
    (r) => r.isValid && r.data !== null && !r.skipDuplicate
  );
  const toImportCount = toImportRows.length;
  const totalCodToCollect = toImportRows.reduce(
    (sum, r) => sum + (r.data?.cod_amount || 0),
    0
  );

  const displayedRows = validatedRows.filter((r) => {
    if (previewFilter === "excluded") return r.isExcluded;
    if (r.isExcluded) return false;
    if (previewFilter === "valid") return r.isValid && !r.skipDuplicate;
    if (previewFilter === "invalid") return !r.isValid;
    if (previewFilter === "duplicate") return r.isDuplicate;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">استيراد أوردرات من ملف Excel</h1>
          <p className="text-sm text-slate-500 mt-1">
            ارفع ملفات الإكسيل لمطابقة الأعمدة والتحقق التلقائي من البيانات وحفظها في قائمة الطباعة
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-2 shadow-sm self-start md:self-auto"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>تحميل نموذج فلكون المعتمد (.xlsx)</span>
        </button>
      </div>

      {/* Wizard Step Indicator */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
          <div
            className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 ${
              currentStep === "upload"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            <span>1. رفع الملف</span>
          </div>

          <div
            className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 ${
              currentStep === "mapping"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            <span>2. مطابقة الأعمدة</span>
          </div>

          <div
            className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 ${
              currentStep === "preview"
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            <span>3. مراجعة وتدقيق</span>
          </div>

          <div
            className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 ${
              currentStep === "complete"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            <span>4. اكتمال الاستيراد</span>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-semibold flex items-center gap-2">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 1: UPLOAD                                            */}
      {/* ========================================================= */}
      {currentStep === "upload" && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-2xl p-10 text-center cursor-pointer transition-all space-y-4"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
              <Upload className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                اسحب وأفلت ملف الإكسيل هنا، أو اضغط للاختيار
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                يدعم صيغ Excel (.xlsx, .xls) وملفات CSV (ترميز UTF-8)
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>اختيار ملف من جهازك</span>
            </div>
          </div>

          {/* Guidelines */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Info className="w-4 h-4 text-blue-600" />
              <span>إرشادات الاستيراد الناجح:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 pr-2">
              <li>
                <strong>أرقام الهواتف المصرية</strong>: يتم الحفاظ على الصفر المبدئي (010, 011, 012, 015) تلقائياً حتى لو تم تصديره كرقم.
              </li>
              <li>
                <strong>توافق تام مع فلكون</strong>: الملفات المصدّرة سابقاً من فلكون يتم التعرف على كافة أعمدتها ومطابقتها فورياً بدون أي تدخل.
              </li>
              <li>
                <strong>الأعمدة الإلزامية</strong>: اسم العميل، رقم الهاتف الأساسي، المحافظة، العنوان بالتفصيل، وإجمالي سعر الأوردر.
              </li>
              <li>
                <strong>جاهزية الطباعة</strong>: كافة الأوردرات المستوردة تنضم فوراً إلى <strong>قائمة انتظار الطباعة</strong>.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 2: COLUMN MAPPING                                    */}
      {/* ========================================================= */}
      {currentStep === "mapping" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">مطابقة أعمدة الملف ({fileName})</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تأكد من مطابقة حقول النظام مع الأعمدة الموجودة في ملفك. تم ضبط المطابقة الذكية تلقائياً.
              </p>
            </div>

            <button
              onClick={() => setCurrentStep("upload")}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>تغيير الملف</span>
            </button>
          </div>

          {/* Preset & Auto-Match Status Banner */}
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-slate-50 border border-indigo-200/70 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">
                    القالب المكتشف: {PLATFORM_PRESETS[detectedPreset]?.name || "ملف مخصص"}
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    مطابقة تلقائية ⚡
                  </span>
                </div>
                <p className="text-slate-500 mt-0.5">
                  تمت مطابقة {Object.values(columnMapping).filter(Boolean).length} من أصل {Object.keys(FIELD_LABELS).length} حقول تلقائياً. يمكنك تعديل أي حقل بحرية.
                </p>
              </div>
            </div>

            {/* Quick Preset Selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium ml-1">تطبيق قالب:</span>
              {Object.entries(PLATFORM_PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setDetectedPreset(key);
                    const autoMap = detectColumnMappings(headers);
                    setColumnMapping(autoMap);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                    detectedPreset === key
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Mapping Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(FIELD_LABELS).map(([fieldKey, label]) => {
              const selectedCol = columnMapping[fieldKey] || "";
              const isRequired = label.includes("*");
              const isMapped = Boolean(selectedCol);

              return (
                <div
                  key={fieldKey}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isMapped
                      ? "bg-slate-50/70 border-slate-200"
                      : isRequired
                      ? "bg-amber-50/50 border-amber-300"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900">
                      {label}
                    </span>
                    {isMapped ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" />
                        تمت المطابقة
                      </span>
                    ) : isRequired ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" />
                        حقل إلزامي
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">اختياري</span>
                    )}
                  </div>

                  <select
                    value={selectedCol}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({
                        ...prev,
                        [fieldKey]: e.target.value,
                      }))
                    }
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">-- غير محدد / تجاهل العمود --</option>
                    {headers.map((h) => {
                      const sample1 = rawRows[0]?.[h] ? String(rawRows[0][h]).trim() : "";
                      const sample2 = rawRows[1]?.[h] ? String(rawRows[1][h]).trim() : "";
                      const sampleText = [sample1, sample2].filter(Boolean).slice(0, 2).join(" | ");
                      return (
                        <option key={h} value={h}>
                          {h} {sampleText ? `(مثال: ${sampleText.slice(0, 30)})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep("upload")}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
            >
              الرجوع للرفع
            </button>

            <button
              onClick={handleProceedToPreview}
              disabled={isValidatingDuplicates}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {isValidatingDuplicates ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري فحص وتدقيق البيانات والمكررات...</span>
                </>
              ) : (
                <>
                  <span>متابعة لتدقيق ومعاينة البيانات ({rawRows.length} صف)</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 3: PREVIEW & VALIDATION                              */}
      {/* ========================================================= */}
      {currentStep === "preview" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {/* Top Header & Overview */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                مراجعة وتدقيق البيانات قبل الإدراج
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                فحص ذكي للمكررات، وتدقيق المحافظات وأسعار الشحن، مع إمكانية التعديل الفوري داخل الجدول
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
              <button
                onClick={() => setPreviewFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  previewFilter === "all"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                الكل ({validatedRows.length})
              </button>

              <button
                onClick={() => setPreviewFilter("valid")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  previewFilter === "valid"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-emerald-700 hover:text-emerald-900"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>جاهز للاستيراد ({toImportCount})</span>
              </button>

              <button
                onClick={() => setPreviewFilter("invalid")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  previewFilter === "invalid"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-rose-700 hover:text-rose-900"
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>به أخطاء ({invalidCount})</span>
              </button>

              {duplicateCount > 0 && (
                <button
                  onClick={() => setPreviewFilter("duplicate")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    previewFilter === "duplicate"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-amber-700 hover:text-amber-900"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>مكررات ({duplicateCount})</span>
                </button>
              )}

              {excludedRows.length > 0 && (
                <button
                  onClick={() => setPreviewFilter("excluded")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                    previewFilter === "excluded"
                      ? "bg-slate-700 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>مستبعد ({excludedRows.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <span className="text-emerald-700 font-medium block">جاهز للاستيراد</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-emerald-900">{toImportCount}</span>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  ({formatEgp(totalCodToCollect)} COD)
                </span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                invalidCount > 0
                  ? "bg-rose-50/70 border-rose-200 text-rose-900"
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
            >
              <span className="font-medium block">يحتاج تصحيح</span>
              <span className="text-xl font-bold mt-1 block">
                {invalidCount} {invalidCount > 0 ? "صف" : "✓ لا يوجد"}
              </span>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                duplicateCount > 0
                  ? "bg-amber-50/70 border-amber-200 text-amber-900"
                  : "bg-slate-50 border-slate-200 text-slate-600"
              }`}
            >
              <span className="font-medium block">مكررات مكتشفة</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold">{duplicateCount}</span>
                {exactDuplicateCount > 0 && (
                  <span className="text-[10px] text-rose-700 font-bold">
                    ({exactDuplicateCount} تطابق تام)
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
              <span className="font-medium block">إجمالي صفوف الملف</span>
              <span className="text-xl font-bold mt-1 block">{validatedRows.length} صف</span>
            </div>
          </div>

          {/* Validation Notice for Errors */}
          {invalidCount > 0 && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  يوجد <strong>{invalidCount}</strong> صف يحتوي على أخطاء (مثل محافظة غير محددة أو هاتف خاطئ).
                  يمكنك الضغط على <strong>&ldquo;تعديل سريع&rdquo;</strong> لتصحيح الصف مباشرة بالجدول دون الحاجة لإعادة رفع الملف.
                </span>
              </div>
            </div>
          )}

          {/* Advanced Duplicate Resolution Strategy Banner */}
          {duplicateCount > 0 && (
            <div className="p-4 bg-gradient-to-r from-amber-50 via-orange-50 to-slate-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900">
                      إدارة ومعالجة المكررات ({duplicateCount} أوردر)
                    </span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      يميز النظام بين الطلب المكرر بالخطأ (نفس العميل والمبلغ) وبين العميل السابق الذي طلب مجدداً.
                    </p>
                  </div>
                </div>

                {/* Strategy Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto shrink-0 pt-1 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handleApplyDuplicateStrategy("skip_exact_only")}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 border shadow-sm ${
                      duplicateStrategy === "skip_exact_only"
                        ? "bg-amber-600 text-white border-amber-600 shadow-amber-500/20"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span>⭐ تخطي التطابق التام فقط (مستحسن)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyDuplicateStrategy("skip_all")}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all border ${
                      duplicateStrategy === "skip_all"
                        ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                        : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                    }`}
                  >
                    تخطي جميع المكررات
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyDuplicateStrategy("import_all")}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all border ${
                      duplicateStrategy === "import_all"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    استيراد الكل
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto shadow-sm">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3 min-w-[130px]">حالة التدقيق</th>
                  <th className="p-3 min-w-[140px]">اسم العميل</th>
                  <th className="p-3 min-w-[130px]">الهاتف</th>
                  <th className="p-3 min-w-[150px]">المحافظة والشحن</th>
                  <th className="p-3 min-w-[160px]">العنوان</th>
                  <th className="p-3 min-w-[90px]">سعر الأوردر</th>
                  <th className="p-3 min-w-[90px]">المطلوب (COD)</th>
                  <th className="p-3 min-w-[90px]">صافي الربح</th>
                  <th className="p-3 text-center min-w-[130px]">إجراءات الصف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRows.slice(0, 100).map((row) => {
                  const isEditing = editingRowNumber === row.rowNumber;

                  if (isEditing) {
                    // Inline Editing Row
                    return (
                      <tr key={row.rowNumber} className="bg-blue-50/60 transition-colors">
                        <td className="p-3 text-center font-mono font-bold text-blue-700">
                          {row.rowNumber}
                        </td>

                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded">
                            <Edit2 className="w-3 h-3" />
                            تعديل مباشر
                          </span>
                        </td>

                        <td className="p-2">
                          <input
                            type="text"
                            value={editDraft.customer_name || ""}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, customer_name: e.target.value }))
                            }
                            placeholder="اسم العميل"
                            className="w-full text-xs p-1.5 bg-white border border-blue-400 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="text"
                            dir="ltr"
                            value={editDraft.phone_primary || ""}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, phone_primary: e.target.value }))
                            }
                            onBlur={() => {
                              if (editDraft.phone_primary) {
                                const split = splitAndNormalizePhoneNumbers(editDraft.phone_primary);
                                setEditDraft((prev) => ({
                                  ...prev,
                                  phone_primary: split.primary,
                                  phone_secondary: prev.phone_secondary || split.secondary || null,
                                }));
                              }
                            }}
                            placeholder="رقم الهاتف"
                            className="w-full text-xs p-1.5 bg-white border border-blue-400 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        <td className="p-2">
                          <select
                            value={editDraft.governorate || ""}
                            onChange={(e) => {
                              const govName = e.target.value;
                              const gRate = shippingRates.find((g) => g.name === govName);
                              const newRate = gRate?.rate ?? 0;
                              setEditDraft((prev) => ({
                                ...prev,
                                governorate: govName,
                                shipping_cost: newRate,
                              }));
                            }}
                            className="w-full text-xs p-1.5 bg-white border border-blue-400 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- حدد المحافظة --</option>
                            {shippingRates.map((g) => (
                              <option key={g.name} value={g.name}>
                                {g.name} ({g.rate} ج.م)
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2">
                          <input
                            type="text"
                            value={editDraft.address || ""}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, address: e.target.value }))
                            }
                            placeholder="العنوان بالتفصيل"
                            className="w-full text-xs p-1.5 bg-white border border-blue-400 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            value={editDraft.order_total ?? 0}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                order_total: Number(e.target.value),
                              }))
                            }
                            className="w-20 text-xs p-1.5 bg-white border border-blue-400 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        <td className="p-2">
                          <div className="text-[11px] font-bold text-slate-700">
                            {formatEgp(
                              calculateCod(
                                editDraft.order_total ?? 0,
                                editDraft.paid_amount ?? 0
                              )
                            )}
                          </div>
                        </td>

                        <td className="p-2">
                          <div className="text-[11px] font-bold text-emerald-700">
                            {formatEgp(
                              calculateNetProfit(
                                editDraft.order_total ?? 0,
                                editDraft.shipping_cost ?? 0
                              )
                            )}
                          </div>
                        </td>

                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(row.rowNumber)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
                              title="حفظ التعديلات"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                              title="إلغاء التعديل"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Normal Row Display
                  return (
                    <tr
                      key={row.rowNumber}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.isExcluded
                          ? "bg-slate-100/50 opacity-40 line-through"
                          : !row.isValid
                          ? "bg-rose-50/30"
                          : row.isDuplicate
                          ? row.duplicateDetails?.badgeVariant === "rose"
                            ? "bg-rose-50/20"
                            : "bg-amber-50/20"
                          : ""
                      }`}
                    >
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {row.rowNumber}
                      </td>

                      <td className="p-3">
                        {row.isExcluded ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                            مستبعد
                          </span>
                        ) : row.isValid ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                صالح
                              </span>

                              {row.isManuallyEdited && (
                                <span className="inline-flex items-center text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                                  معدل يدوياً ✓
                                </span>
                              )}
                            </div>

                            {row.isDuplicate && (
                              <div className="space-y-0.5">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    row.duplicateDetails?.badgeVariant === "rose"
                                      ? "bg-rose-50 text-rose-800 border-rose-200"
                                      : row.duplicateDetails?.badgeVariant === "blue"
                                      ? "bg-blue-50 text-blue-800 border-blue-200"
                                      : "bg-amber-50 text-amber-800 border-amber-200"
                                  }`}
                                >
                                  {row.duplicateDetails?.badgeVariant === "blue" ? (
                                    <UserCheck className="w-3 h-3 text-blue-600" />
                                  ) : (
                                    <AlertTriangle className="w-3 h-3" />
                                  )}
                                  {row.duplicateDetails?.badgeText || "مكرر"}
                                </span>
                                <div className="text-[10px] text-slate-600 font-medium leading-tight">
                                  {row.duplicateReason}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              خطأ ({row.errors.length})
                            </span>
                            <div className="text-[10px] text-rose-600 font-semibold leading-tight">
                              {row.errors.join(" • ")}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(row)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>تصحيح فوري</span>
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="p-3 font-bold text-slate-900">
                        {row.data?.customer_name ||
                          String(row.raw[columnMapping.customer_name] || "-")}
                      </td>

                      <td className="p-3 font-mono" dir="ltr">
                        <div>
                          {row.data?.phone_primary ||
                            String(row.raw[columnMapping.phone_primary] || "-")}
                        </div>
                        {row.data?.phone_secondary && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            إضافي: {row.data.phone_secondary}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        {row.governorateMatched ? (
                          <div>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold inline-block">
                              {row.data?.governorate}
                            </span>
                            <span className="text-[11px] text-blue-600 font-semibold block mt-0.5">
                              شحن: {formatEgp(row.data?.shipping_cost ?? 0)}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1 min-w-[150px]">
                            <div className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                              غير معروفة ({row.governorateRaw || "فارغة"})
                            </div>
                            <select
                              defaultValue=""
                              onChange={(e) =>
                                handleResolveGovernorate(row.rowNumber, e.target.value)
                              }
                              className="w-full text-xs p-1 bg-white border border-amber-400 rounded-lg text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 shadow-sm"
                            >
                              <option value="" disabled>
                                -- حدد المحافظة --
                              </option>
                              {shippingRates.map((g) => (
                                <option key={g.name} value={g.name}>
                                  {g.name} ({g.rate} ج.م)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>

                      <td
                        className="p-3 max-w-xs truncate text-slate-600"
                        title={
                          row.data?.address || String(row.raw[columnMapping.address] || "-")
                        }
                      >
                        {row.data?.address || String(row.raw[columnMapping.address] || "-")}
                      </td>

                      <td className="p-3 font-bold text-slate-900">
                        {row.data?.order_total !== undefined
                          ? formatEgp(row.data.order_total)
                          : String(row.raw[columnMapping.order_total] || "-")}
                      </td>

                      <td className="p-3 font-bold text-slate-900">
                        {row.data?.cod_amount !== undefined ? (
                          row.data.cod_amount === 0 ? (
                            <span className="text-emerald-700 font-bold">مدفوع بالكامل</span>
                          ) : (
                            formatEgp(row.data.cod_amount)
                          )
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="p-3 font-bold text-emerald-700">
                        {row.data?.net_profit !== undefined
                          ? formatEgp(row.data.net_profit)
                          : "-"}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {row.isDuplicate && !row.isExcluded && row.isValid && (
                            <button
                              type="button"
                              onClick={() => handleToggleSkipDuplicate(row.rowNumber)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                row.skipDuplicate
                                  ? "bg-slate-100 text-slate-500 border-slate-300"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm"
                              }`}
                              title={row.skipDuplicate ? "الضغط للاستيراد" : "الضغط للتخطي"}
                            >
                              {row.skipDuplicate ? "متجاهل" : "استيراد ✓"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartEdit(row)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="تعديل هذا الصف"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleExcludeRow(row.rowNumber)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              row.isExcluded
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            }`}
                            title={row.isExcluded ? "استعادة الصف" : "استبعاد الصف من الاستيراد"}
                          >
                            {row.isExcluded ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep("mapping")}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
            >
              الرجوع لتعديل المطابقة
            </button>

            <button
              onClick={handleExecuteImport}
              disabled={isPending || toImportCount === 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الاستيراد والحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>تأكيد استيراد ({toImportCount}) أوردر إلى قائمة الطباعة</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 4: COMPLETE                                          */}
      {/* ========================================================= */}
      {currentStep === "complete" && (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">
              تم استيراد {importResult?.count} أوردر بنجاح!
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              تم إدراج الأوردرات في قاعدة البيانات مع الحساب المالي التلقائي (COD وصافي الربح)
              وإضافتها مباشرة إلى <strong>قائمة انتظار الطباعة</strong>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/print/queue"
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 text-sm"
            >
              <Printer className="w-4 h-4" />
              <span>الذهاب إلى قائمة الطباعة الآن</span>
            </Link>

            <Link
              href="/orders"
              className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm"
            >
              <span>عرض الطلبات في الجدول</span>
            </Link>

            <button
              onClick={() => {
                setFileName("");
                setHeaders([]);
                setRawRows([]);
                setValidatedRows([]);
                setImportResult(null);
                setCurrentStep("upload");
              }}
              className="w-full sm:w-auto px-4 py-3 text-slate-500 hover:text-slate-800 text-sm font-semibold"
            >
              استيراد ملف آخر
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
