"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  Download,
  Printer,
  Edit2,
  ChevronRight,
  ChevronLeft,
  X,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import { Order, PrintStatus, DeliveryStatus, SettlementStatus, PaymentStatus } from "@/types/database";
import { formatEgp, getPaymentStatusBadge } from "@/lib/calculations";
import { getOrdersAction, updateOrderAction, batchUpdatePrintStatusAction } from "@/app/actions/orders";

interface OrdersTableProps {
  initialPrintStatus?: string;
  pageTitle?: string;
  hidePrintStatusFilter?: boolean;
}

export function OrdersTable({
  initialPrintStatus = "all",
  pageTitle = "إدارة الطلبات",
  hidePrintStatusFilter = false,
}: OrdersTableProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState("");
  const [printStatus, setPrintStatus] = useState(initialPrintStatus);
  const [deliveryStatus, setDeliveryStatus] = useState("all");
  const [settlementStatus, setSettlementStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Edit Modal State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Order>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Fetch orders from server action
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrdersAction({
        page: currentPage,
        pageSize,
        search,
        printStatus: printStatus === "all" ? undefined : printStatus,
        deliveryStatus: deliveryStatus === "all" ? undefined : deliveryStatus,
        settlementStatus: settlementStatus === "all" ? undefined : settlementStatus,
        paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (res.success && res.data) {
        setOrders(res.data.orders);
        setTotalOrders(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, search, printStatus, deliveryStatus, settlementStatus, paymentStatus, startDate, endDate]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handle Search Debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  // Selection logic
  const handleToggleSelectAllOnPage = () => {
    if (selectedIds.length === orders.length && orders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((o) => o.id));
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Export to Excel handler
  const handleExportExcel = async (mode: "selected" | "filtered" | "all") => {
    setIsExporting(true);
    setExportError(null);

    try {
      const payload = {
        mode,
        selectedIds: mode === "selected" ? selectedIds : [],
        search,
        printStatus: printStatus === "all" ? undefined : printStatus,
        deliveryStatus: deliveryStatus === "all" ? undefined : deliveryStatus,
        settlementStatus: settlementStatus === "all" ? undefined : settlementStatus,
        paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
        startDate,
        endDate,
        sheetName: pageTitle,
        fileNamePrefix: "Falcon_Orders",
      };

      const res = await fetch("/api/orders/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "فشل تصدير البيانات");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().split("T")[0];
      a.download = `Falcon_Orders_${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل التصدير";
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  // Edit order modal trigger
  const handleOpenEdit = (order: Order) => {
    setEditingOrder(order);
    setEditFormData({
      customer_name: order.customer_name,
      phone_primary: order.phone_primary,
      phone_secondary: order.phone_secondary,
      governorate: order.governorate,
      address: order.address,
      landmark: order.landmark,
      order_total: order.order_total,
      paid_amount: order.paid_amount,
      shipping_cost: order.shipping_cost,
      important_notes: order.important_notes,
      print_status: order.print_status,
      delivery_status: order.delivery_status,
      settlement_status: order.settlement_status,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    setIsSavingEdit(true);
    setEditError(null);

    const res = await updateOrderAction(editingOrder.id, editFormData);

    if (!res.success) {
      setEditError(res.error || "فشل تحديث الأوردر");
      setIsSavingEdit(false);
      return;
    }

    setIsSavingEdit(false);
    setEditingOrder(null);
    loadOrders();
  };

  // Move selected to Print Queue
  const handleSendSelectedToPrintQueue = () => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      await batchUpdatePrintStatusAction(selectedIds, "pending");
      router.push(`/print/queue?selected=${selectedIds.join(",")}`);
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-xs text-slate-500 mt-1">
            إجمالي الطلبات المطابقة: <span className="font-bold text-slate-800">{totalOrders}</span> أوردر
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => loadOrders()}
            className="h-10 px-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button
              disabled={isExporting}
              className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm shadow-emerald-600/20 transition-colors"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>تصدير Excel</span>
            </button>

            <div className="absolute left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 hidden group-hover:block transition-all">
              {selectedIds.length > 0 && (
                <button
                  onClick={() => handleExportExcel("selected")}
                  className="w-full text-right px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>الصفوف المحددة فقط</span>
                  <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {selectedIds.length}
                  </span>
                </button>
              )}
              <button
                onClick={() => handleExportExcel("filtered")}
                className="w-full text-right px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
              >
                <span>النتائج الحالية المطابقة</span>
                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                  {totalOrders}
                </span>
              </button>
              <button
                onClick={() => handleExportExcel("all")}
                className="w-full text-right px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>كل البيانات المصرح بها</span>
              </button>
            </div>
          </div>

          <Link
            href="/orders/create"
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-blue-600/20 transition-colors"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            <span>+ إنشاء بوليصة</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="ابحث بالاسم، رقم الهاتف، أو العنوان..."
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>

          {/* Print Status Filter */}
          {!hidePrintStatusFilter && (
            <div>
              <select
                value={printStatus}
                onChange={(e) => {
                  setPrintStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">كل حالات الطباعة</option>
                <option value="pending">في انتظار الطباعة</option>
                <option value="printed">تم الطباعة</option>
              </select>
            </div>
          )}

          {/* Payment Status Filter */}
          <div>
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">كل حالات الدفع</option>
              <option value="unpaid">غير مدفوع</option>
              <option value="partially_paid">مدفوع جزئياً</option>
              <option value="fully_paid">مدفوع بالكامل</option>
            </select>
          </div>

          {/* Delivery Status Filter */}
          <div>
            <select
              value={deliveryStatus}
              onChange={(e) => {
                setDeliveryStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">كل حالات التوصيل</option>
              <option value="new">جديد</option>
              <option value="handed_to_carrier">تم التسليم للمندوب</option>
              <option value="delivered">تم التوصيل</option>
              <option value="returned">مرتجع</option>
            </select>
          </div>

          {/* Settlement Status Filter */}
          <div>
            <select
              value={settlementStatus}
              onChange={(e) => {
                setSettlementStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">كل حالات التسوية</option>
              <option value="pending">معلق عند شركة الشحن</option>
              <option value="settled">تمت التسوية</option>
            </select>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">تاريخ الأوردر:</span>
          <div className="flex items-center gap-1.5">
            <span>من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span>إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          {(startDate || endDate || search || printStatus !== initialPrintStatus || deliveryStatus !== "all" || settlementStatus !== "all" || paymentStatus !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setPrintStatus(initialPrintStatus);
                setDeliveryStatus("all");
                setSettlementStatus("all");
                setPaymentStatus("all");
                setStartDate("");
                setEndDate("");
                setCurrentPage(1);
              }}
              className="text-blue-600 hover:underline mr-auto font-medium"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="bg-blue-700 px-2.5 py-1 rounded-lg">
              تم تحديد {selectedIds.length} أوردر
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleExportExcel("selected")}
              disabled={isExporting}
              className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير Excel للمحدد</span>
            </button>

            <button
              onClick={handleSendSelectedToPrintQueue}
              className="h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة البوالص المحددة</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-blue-300 hover:text-white rounded-lg hover:bg-blue-800 transition-colors"
              title="إلغاء التحديد"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Orders Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAllOnPage}
                    className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="تحديد الكل"
                  >
                    {selectedIds.length === orders.length && orders.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">اسم العميل</th>
                <th className="p-3">الهاتف</th>
                <th className="p-3">المحافظة والعنوان</th>
                <th className="p-3">سعر الأوردر</th>
                <th className="p-3">المدفوع</th>
                <th className="p-3">المطلوب (COD)</th>
                <th className="p-3">الشحن</th>
                <th className="p-3">صافي الربح</th>
                <th className="p-3">حالة الدفع</th>
                <th className="p-3">حالة الطباعة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                    <span className="mt-2 block">جاري تحميل بيانات الطلبات...</span>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-2">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <span className="font-semibold text-slate-700 block">لا توجد طلبات مطابقة</span>
                    <span className="text-xs text-slate-400">جرب تغيير كلمات البحث أو خيارات الفلترة</span>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const isSelected = selectedIds.includes(order.id);
                  const paymentBadge = getPaymentStatusBadge(order.payment_status);

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleRow(order.id)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="p-3 whitespace-nowrap text-slate-600 font-medium">
                        {order.order_date}
                      </td>

                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        {order.customer_name}
                      </td>

                      <td className="p-3 font-mono font-semibold text-slate-700 whitespace-nowrap" dir="ltr">
                        {order.phone_primary}
                      </td>

                      <td className="p-3 max-w-xs truncate text-slate-600" title={`${order.governorate} - ${order.address}`}>
                        <span className="font-semibold text-slate-800 ml-1">{order.governorate}:</span>
                        <span>{order.address}</span>
                      </td>

                      <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">
                        {formatEgp(order.order_total)}
                      </td>

                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {formatEgp(order.paid_amount)}
                      </td>

                      <td className="p-3 font-bold text-blue-700 whitespace-nowrap">
                        {order.cod_amount === 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            مدفوع بالكامل
                          </span>
                        ) : (
                          formatEgp(order.cod_amount)
                        )}
                      </td>

                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {formatEgp(order.shipping_cost)}
                      </td>

                      <td className="p-3 font-bold text-emerald-700 whitespace-nowrap">
                        {formatEgp(order.net_profit)}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-md border text-[11px] font-semibold ${paymentBadge.bgClass} ${paymentBadge.textClass}`}
                        >
                          {paymentBadge.label}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {order.print_status === "printed" ? (
                          <span className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-[11px] font-semibold flex items-center gap-1 w-max">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            تم الطباعة
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-md text-[11px] font-semibold w-max block">
                            في الانتظار
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(order)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="تعديل الأوردر"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <Link
                            href={`/print/queue?selected=${order.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                            title="طباعة البوليصة"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <span>عرض صفحة </span>
            <span className="font-bold text-slate-800">{currentPage}</span>
            <span> من أصل </span>
            <span className="font-bold text-slate-800">{totalPages}</span>
            <span> صفحة (إجمالي {totalOrders} أوردر)</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
            >
              <option value={25}>25 لكل صفحة</option>
              <option value={50}>50 لكل صفحة</option>
              <option value={100}>100 لكل صفحة</option>
            </select>

            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1 || loading}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title="الصفحة السابقة"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages || loading}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
              title="الصفحة التالية"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>تعديل بيانات الأوردر</span>
              </h3>
              <button
                onClick={() => setEditingOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اسم العميل</label>
                  <input
                    type="text"
                    required
                    value={editFormData.customer_name || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رقم الهاتف الأساسي</label>
                  <input
                    type="text"
                    required
                    value={editFormData.phone_primary || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, phone_primary: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المحافظة</label>
                  <input
                    type="text"
                    required
                    value={editFormData.governorate || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, governorate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">سعر الأوردر الكامل</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editFormData.order_total ?? 0}
                    onChange={(e) => setEditFormData({ ...editFormData, order_total: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">المدفوع مقدماً</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editFormData.paid_amount ?? 0}
                    onChange={(e) => setEditFormData({ ...editFormData, paid_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">سعر الشحن</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editFormData.shipping_cost ?? 0}
                    onChange={(e) => setEditFormData({ ...editFormData, shipping_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">العنوان بالتفصيل</label>
                  <textarea
                    rows={2}
                    required
                    value={editFormData.address || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات للمندوب</label>
                  <textarea
                    rows={2}
                    value={editFormData.important_notes || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, important_notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">حالة الطباعة</label>
                  <select
                    value={editFormData.print_status || "pending"}
                    onChange={(e) => setEditFormData({ ...editFormData, print_status: e.target.value as PrintStatus })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    <option value="pending">في انتظار الطباعة</option>
                    <option value="printed">تم الطباعة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">حالة التوصيل</label>
                  <select
                    value={editFormData.delivery_status || "new"}
                    onChange={(e) => setEditFormData({ ...editFormData, delivery_status: e.target.value as DeliveryStatus })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    <option value="new">جديد</option>
                    <option value="handed_to_carrier">تم التسليم للمندوب</option>
                    <option value="delivered">تم التوصيل</option>
                    <option value="returned">مرتجع</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>حفظ التعديلات</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
