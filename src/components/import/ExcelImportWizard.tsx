"use client";

import { useState, useRef, useTransition } from "react";
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
} from "lucide-react";
import { OrderInsert } from "@/types/database";
import { formatEgp } from "@/lib/calculations";
import {
  detectColumnMappings,
  validateImportRow,
  generateSampleExcelTemplate,
  FIELD_LABELS,
  ValidatedImportRow,
} from "@/lib/excel-import";
import { batchCreateOrdersAction } from "@/app/actions/orders";

type Step = "upload" | "mapping" | "preview" | "complete";

export function ExcelImportWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard Step
  const [currentStep, setCurrentStep] = useState<Step>("upload");

  // Raw file & parsed data
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Validation results
  const [validatedRows, setValidatedRows] = useState<ValidatedImportRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<"all" | "valid" | "invalid">("all");

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

        // Auto-detect mappings
        const detected = detectColumnMappings(sheetHeaders);
        setColumnMapping(detected);

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

  // Proceed to Preview
  const handleProceedToPreview = () => {
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

    // Validate all rows
    const validated = rawRows.map((row, idx) =>
      validateImportRow(row, columnMapping, idx + 1)
    );

    setValidatedRows(validated);
    setCurrentStep("preview");
  };

  // Execute Batch Import
  const handleExecuteImport = () => {
    const validOrders = validatedRows
      .filter((r) => r.isValid && r.data !== null)
      .map((r) => r.data as OrderInsert);

    if (validOrders.length === 0) {
      setError("لا توجد أي صفوف صالحة للاستيراد");
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
  const displayedRows = validatedRows.filter((r) => {
    if (previewFilter === "valid") return r.isValid;
    if (previewFilter === "invalid") return !r.isValid;
    return true;
  });

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.length - validCount;

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
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h} {rawRows[0]?.[h] ? `(مثال: ${String(rawRows[0][h]).slice(0, 20)})` : ""}
                      </option>
                    ))}
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
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              <span>متابعة لتدقيق ومعاينة البيانات ({rawRows.length} صف)</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 3: PREVIEW & VALIDATION                              */}
      {/* ========================================================= */}
      {currentStep === "preview" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                مراجعة وتدقيق البيانات قبل الإدراج
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                فحص الصلاحية التلقائي لحقول الأسعار وأرقام الهواتف والعناوين
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
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
                <span>صالح للاستيراد ({validCount})</span>
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
            </div>
          </div>

          {/* Validation Notice */}
          {invalidCount > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  يوجد <strong>{invalidCount}</strong> صف يحتوي على أخطاء ولن يتم إدراجه. يمكنك
                  استيراد الـ <strong>{validCount}</strong> صف الصالحة فوراً.
                </span>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">حالة التدقيق</th>
                  <th className="p-3">اسم العميل</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">المحافظة والعنوان</th>
                  <th className="p-3">سعر الأوردر</th>
                  <th className="p-3">المدفوع</th>
                  <th className="p-3">المطلوب (COD)</th>
                  <th className="p-3">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRows.slice(0, 100).map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      !row.isValid ? "bg-rose-50/30" : ""
                    }`}
                  >
                    <td className="p-3 text-center text-slate-400 font-mono">
                      {row.rowNumber}
                    </td>

                    <td className="p-3">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          صالح
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            خطأ
                          </span>
                          <div className="text-[10px] text-rose-600 font-semibold leading-tight">
                            {row.errors.join(" • ")}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="p-3 font-bold text-slate-900">
                      {row.data?.customer_name || String(row.raw[columnMapping.customer_name] || "-")}
                    </td>

                    <td className="p-3 font-mono" dir="ltr">
                      {row.data?.phone_primary || String(row.raw[columnMapping.phone_primary] || "-")}
                    </td>

                    <td className="p-3 max-w-xs">
                      <span className="font-semibold text-slate-800">
                        {row.data?.governorate || String(row.raw[columnMapping.governorate] || "-")}
                      </span>
                      <span className="text-slate-500 block truncate">
                        {row.data?.address || String(row.raw[columnMapping.address] || "-")}
                      </span>
                    </td>

                    <td className="p-3 font-bold text-slate-900">
                      {row.data?.order_total !== undefined
                        ? formatEgp(row.data.order_total)
                        : String(row.raw[columnMapping.order_total] || "-")}
                    </td>

                    <td className="p-3 text-slate-600">
                      {row.data?.paid_amount !== undefined
                        ? formatEgp(row.data.paid_amount)
                        : String(row.raw[columnMapping.paid_amount] || "0")}
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

                    <td className="p-3 text-slate-500 max-w-[150px] truncate">
                      {row.data?.important_notes || "-"}
                    </td>
                  </tr>
                ))}
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
              disabled={isPending || validCount === 0}
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
                  <span>تأكيد استيراد ({validCount}) أوردر إلى قائمة الطباعة</span>
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
