import { Order, DeliveryStatus, SettlementStatus } from "@/types/database";

export interface CarrierSettlementRow {
  rowId: string;
  orderIdOrRef: string;
  phone?: string;
  customerName?: string;
  courierCod: number;
  courierShippingFee: number;
  courierNet?: number;
  courierStatus?: string;
  rawRecord: Record<string, unknown>;
}

export type ReconciliationStatus =
  | "matched_perfect"
  | "matched_discrepancy"
  | "not_found_in_system"
  | "already_settled";

export interface ReconciledOrderResult {
  rowId: string;
  orderIdOrRef: string;
  matchedOrder?: Order;
  phone?: string;
  customerName?: string;
  courierCod: number;
  courierShippingFee: number;
  courierNet: number;
  courierStatus?: string;

  // System values
  expectedCod: number;
  expectedShippingFee: number;
  expectedNet: number;

  // Discrepancies
  codDiscrepancy: number; // courierCod - expectedCod (positive means courier collected more, negative means collected less)
  shippingDiscrepancy: number; // courierShippingFee - expectedShippingFee (positive means courier deducted more shipping than expected)
  netVariance: number; // courierNet - expectedNet

  status: ReconciliationStatus;
  discrepancyNotes: string[];
}

export interface ReconciliationReport {
  results: ReconciledOrderResult[];
  unsettledSystemOrders: Order[]; // Orders in system that courier didn't report in this sheet

  summary: {
    totalCourierRows: number;
    perfectMatchesCount: number;
    discrepanciesCount: number;
    notFoundCount: number;
    alreadySettledCount: number;
    unsettledSystemOrdersCount: number;

    totalCourierCod: number;
    totalExpectedCod: number;
    totalCourierShipping: number;
    totalExpectedShipping: number;

    totalCodDiscrepancy: number;
    totalShippingDiscrepancy: number;

    netCourierPayable: number;
    netExpectedPayable: number;
    netVariance: number;

    readyToSettleOrderIds: string[];
  };
}

/**
 * Normalizes raw numeric inputs from Excel/CSV (stripping currency symbols, spaces, commas)
 */
export function cleanNumericValue(val: unknown): number {
  if (typeof val === "number") {
    return isNaN(val) ? 0 : val;
  }
  if (!val) return 0;

  const str = String(val)
    .replace(/ج\.م|جنيه/gi, "")
    .replace(/[^0-9.-]/g, "")
    .trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalizes an identifier string (trims, strips leading `#`, handles casing)
 */
export function normalizeIdentifier(val: unknown): string {
  if (!val) return "";
  return String(val)
    .trim()
    .replace(/^#+/, "")
    .trim();
}

/**
 * Detects headers and extracts standardized settlement rows from raw table records
 */
export function parseCourierSettlementRecords(
  records: Array<Record<string, unknown>>
): CarrierSettlementRow[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  // Keys dictionary for detection
  const orderIdKeywords = [
    "كود الأوردر",
    "كود الشحنة",
    "رقم الأوردر",
    "رقم الطلب",
    "order id",
    "order_id",
    "orderid",
    "order #",
    "order",
    "reference",
    "ref",
    "مرجع التاجر",
    "بوليصة",
    "waybill",
    "hawb",
    "tracking",
    "tracking_number",
    "awb",
    "رقم الشحنة",
    "code",
  ];

  const phoneKeywords = [
    "رقم الهاتف",
    "موبايل",
    "هاتف",
    "تليفون",
    "phone",
    "mobile",
    "tel",
    "customer phone",
  ];

  const nameKeywords = [
    "اسم العميل",
    "العميل",
    "المستلم",
    "اسم المستلم",
    "customer",
    "client",
    "name",
    "recipient",
  ];

  const codKeywords = [
    "مبلغ التحصيل",
    "التحصيل",
    "المطلوب تحصيله",
    "cod",
    "collected",
    "collection",
    "مبلغ الدفع",
    "المبلغ المطلوب",
    "cod amount",
    "قيمة الشحنة",
    "cash on delivery",
    "amount",
  ];

  const shippingKeywords = [
    "مصاريف الشحن",
    "تكلفة الشحن",
    "سعر الشحن",
    "رسوم الشحن",
    "شحن",
    "shipping",
    "shipping fee",
    "shipping fees",
    "shipping cost",
    "delivery fee",
    "fees",
    "مصاريف",
    "عمولة الشحن",
  ];

  const netKeywords = [
    "الصافي",
    "صافي المحول",
    "المحول",
    "المستحق للتاجر",
    "net",
    "net amount",
    "net payout",
    "payout",
  ];

  const statusKeywords = [
    "الحالة",
    "حالة التوصيل",
    "حالة الشحنة",
    "status",
    "delivery status",
  ];

  // Helper to find column matching any keyword
  const findKey = (row: Record<string, unknown>, keywords: string[]): string | null => {
    const rowKeys = Object.keys(row);
    for (const kw of keywords) {
      const match = rowKeys.find((k) => k.toLowerCase().trim() === kw.toLowerCase().trim());
      if (match) return match;
    }
    // Partial substring fallback
    for (const kw of keywords) {
      const match = rowKeys.find((k) => k.toLowerCase().includes(kw.toLowerCase()));
      if (match) return match;
    }
    return null;
  };

  const firstRow = records[0] || {};
  const idCol = findKey(firstRow, orderIdKeywords);
  const phoneCol = findKey(firstRow, phoneKeywords);
  const nameCol = findKey(firstRow, nameKeywords);
  const codCol = findKey(firstRow, codKeywords);
  const shippingCol = findKey(firstRow, shippingKeywords);
  const netCol = findKey(firstRow, netKeywords);
  const statusCol = findKey(firstRow, statusKeywords);

  return records.map((record, index) => {
    const rawId = idCol ? normalizeIdentifier(record[idCol]) : "";
    const phone = phoneCol ? normalizeIdentifier(record[phoneCol]) : undefined;
    const customerName = nameCol ? String(record[nameCol] || "").trim() : undefined;
    const courierCod = codCol ? cleanNumericValue(record[codCol]) : 0;
    const courierShippingFee = shippingCol ? cleanNumericValue(record[shippingCol]) : 0;
    const rawNet = netCol ? cleanNumericValue(record[netCol]) : undefined;
    const courierNet = rawNet !== undefined ? rawNet : courierCod - courierShippingFee;
    const courierStatus = statusCol ? String(record[statusCol] || "").trim() : undefined;

    return {
      rowId: `row_${index + 1}_${rawId || Math.random().toString(36).substring(7)}`,
      orderIdOrRef: rawId,
      phone,
      customerName,
      courierCod,
      courierShippingFee,
      courierNet,
      courierStatus,
      rawRecord: record,
    };
  });
}

/**
 * Reconciles parsed courier settlement rows against the merchant's Falcon orders database.
 */
export function reconcileSettlement(
  courierRows: CarrierSettlementRow[],
  systemOrders: Order[]
): ReconciliationReport {
  // Build lookup maps for fast matching
  const exactIdMap = new Map<string, Order>();
  const shortIdMap = new Map<string, Order>();
  const phoneMap = new Map<string, Order>();

  systemOrders.forEach((o) => {
    const cleanId = o.id.toLowerCase().trim();
    exactIdMap.set(cleanId, o);

    // First 8 characters UUID prefix
    const short = cleanId.slice(0, 8);
    if (!shortIdMap.has(short)) {
      shortIdMap.set(short, o);
    }

    // Phone matching (primary and secondary)
    if (o.phone_primary) {
      const p = String(o.phone_primary).trim();
      if (p) phoneMap.set(p, o);
    }
    if (o.phone_secondary) {
      const p2 = String(o.phone_secondary).trim();
      if (p2) phoneMap.set(p2, o);
    }
  });

  const matchedSystemOrderIds = new Set<string>();
  const results: ReconciledOrderResult[] = [];

  let perfectMatchesCount = 0;
  let discrepanciesCount = 0;
  let notFoundCount = 0;
  let alreadySettledCount = 0;

  let totalCourierCod = 0;
  let totalExpectedCod = 0;
  let totalCourierShipping = 0;
  let totalExpectedShipping = 0;

  const readyToSettleOrderIds: string[] = [];

  courierRows.forEach((row) => {
    const rawRef = row.orderIdOrRef.toLowerCase().trim();
    let matchedOrder: Order | undefined;

    if (rawRef) {
      // 1. Exact ID match
      matchedOrder = exactIdMap.get(rawRef);

      // 2. Short ID match (first 8 chars or full startsWith)
      if (!matchedOrder && rawRef.length >= 8) {
        matchedOrder = shortIdMap.get(rawRef.slice(0, 8));
      }

      // 3. System ID starts with rawRef or rawRef starts with System ID
      if (!matchedOrder) {
        matchedOrder = systemOrders.find(
          (o) =>
            o.id.toLowerCase().startsWith(rawRef) ||
            rawRef.startsWith(o.id.toLowerCase().slice(0, 8))
        );
      }
    }

    // 4. Fallback phone match if no ID match found
    if (!matchedOrder && row.phone) {
      matchedOrder = phoneMap.get(row.phone);
    }

    if (!matchedOrder) {
      notFoundCount++;
      totalCourierCod += row.courierCod;
      totalCourierShipping += row.courierShippingFee;

      results.push({
        rowId: row.rowId,
        orderIdOrRef: row.orderIdOrRef || "غير محدد",
        phone: row.phone,
        customerName: row.customerName,
        courierCod: row.courierCod,
        courierShippingFee: row.courierShippingFee,
        courierNet: row.courierNet ?? row.courierCod - row.courierShippingFee,
        courierStatus: row.courierStatus,
        expectedCod: 0,
        expectedShippingFee: 0,
        expectedNet: 0,
        codDiscrepancy: row.courierCod,
        shippingDiscrepancy: row.courierShippingFee,
        netVariance: row.courierNet ?? row.courierCod - row.courierShippingFee,
        status: "not_found_in_system",
        discrepancyNotes: ["رقم الأوردر غير مسجل في نظام فلكون للشحن"],
      });
      return;
    }

    // Mark as matched
    matchedSystemOrderIds.add(matchedOrder.id);

    const expectedCod = Number(matchedOrder.cod_amount || 0);
    const expectedShipping = Number(matchedOrder.shipping_cost || 0);
    const expectedNet = expectedCod - expectedShipping;

    const courierNet =
      row.courierNet !== undefined
        ? row.courierNet
        : row.courierCod - row.courierShippingFee;

    const codDiscrepancy = row.courierCod - expectedCod;
    const shippingDiscrepancy = row.courierShippingFee - expectedShipping;
    const netVariance = courierNet - expectedNet;

    totalCourierCod += row.courierCod;
    totalExpectedCod += expectedCod;
    totalCourierShipping += row.courierShippingFee;
    totalExpectedShipping += expectedShipping;

    const discrepancyNotes: string[] = [];

    // Already settled check
    if (matchedOrder.settlement_status === "settled") {
      alreadySettledCount++;
      discrepancyNotes.push("تمت تسوية هذا الأوردر مسبقاً في النظام");
      results.push({
        rowId: row.rowId,
        orderIdOrRef: row.orderIdOrRef || matchedOrder.id,
        matchedOrder,
        phone: row.phone || matchedOrder.phone_primary,
        customerName: row.customerName || matchedOrder.customer_name,
        courierCod: row.courierCod,
        courierShippingFee: row.courierShippingFee,
        courierNet,
        courierStatus: row.courierStatus,
        expectedCod,
        expectedShippingFee: expectedShipping,
        expectedNet,
        codDiscrepancy,
        shippingDiscrepancy,
        netVariance,
        status: "already_settled",
        discrepancyNotes,
      });
      return;
    }

    // Tolerance of 0.5 EGP for rounding
    const hasCodDiff = Math.abs(codDiscrepancy) > 0.5;
    const hasShippingDiff = Math.abs(shippingDiscrepancy) > 0.5;

    if (hasCodDiff) {
      if (codDiscrepancy > 0) {
        discrepancyNotes.push(
          `التحصيل المورد أعلى من المتوقع بـ ${codDiscrepancy.toFixed(2)} ج.م`
        );
      } else {
        discrepancyNotes.push(
          `عجز في التحصيل: المورد أقل بـ ${Math.abs(codDiscrepancy).toFixed(2)} ج.م`
        );
      }
    }

    if (hasShippingDiff) {
      if (shippingDiscrepancy > 0) {
        discrepancyNotes.push(
          `خصم شحن إضافي: شركة الشحن خصمت ${shippingDiscrepancy.toFixed(2)} ج.م زيادة`
        );
      } else {
        discrepancyNotes.push(
          `خصم شحن أقل: وفرت ${Math.abs(shippingDiscrepancy).toFixed(2)} ج.م`
        );
      }
    }

    if (hasCodDiff || hasShippingDiff) {
      discrepanciesCount++;
      results.push({
        rowId: row.rowId,
        orderIdOrRef: row.orderIdOrRef || matchedOrder.id,
        matchedOrder,
        phone: row.phone || matchedOrder.phone_primary,
        customerName: row.customerName || matchedOrder.customer_name,
        courierCod: row.courierCod,
        courierShippingFee: row.courierShippingFee,
        courierNet,
        courierStatus: row.courierStatus,
        expectedCod,
        expectedShippingFee: expectedShipping,
        expectedNet,
        codDiscrepancy,
        shippingDiscrepancy,
        netVariance,
        status: "matched_discrepancy",
        discrepancyNotes,
      });
    } else {
      perfectMatchesCount++;
      readyToSettleOrderIds.push(matchedOrder.id);
      results.push({
        rowId: row.rowId,
        orderIdOrRef: row.orderIdOrRef || matchedOrder.id,
        matchedOrder,
        phone: row.phone || matchedOrder.phone_primary,
        customerName: row.customerName || matchedOrder.customer_name,
        courierCod: row.courierCod,
        courierShippingFee: row.courierShippingFee,
        courierNet,
        courierStatus: row.courierStatus,
        expectedCod,
        expectedShippingFee: expectedShipping,
        expectedNet,
        codDiscrepancy: 0,
        shippingDiscrepancy: 0,
        netVariance: 0,
        status: "matched_perfect",
        discrepancyNotes: ["مطابق 100% وجاهز للتسوية"],
      });
    }
  });

  // Identify system orders that are pending with carrier but NOT reported in this statement
  const unsettledSystemOrders = systemOrders.filter(
    (o) =>
      !matchedSystemOrderIds.has(o.id) &&
      o.settlement_status === "pending" &&
      (o.delivery_status === "handed_to_carrier" || o.delivery_status === "delivered")
  );

  const totalCodDiscrepancy = totalCourierCod - totalExpectedCod;
  const totalShippingDiscrepancy = totalCourierShipping - totalExpectedShipping;
  const netCourierPayable = totalCourierCod - totalCourierShipping;
  const netExpectedPayable = totalExpectedCod - totalExpectedShipping;
  const netVariance = netCourierPayable - netExpectedPayable;

  return {
    results,
    unsettledSystemOrders,
    summary: {
      totalCourierRows: courierRows.length,
      perfectMatchesCount,
      discrepanciesCount,
      notFoundCount,
      alreadySettledCount,
      unsettledSystemOrdersCount: unsettledSystemOrders.length,
      totalCourierCod,
      totalExpectedCod,
      totalCourierShipping,
      totalExpectedShipping,
      totalCodDiscrepancy,
      totalShippingDiscrepancy,
      netCourierPayable,
      netExpectedPayable,
      netVariance,
      readyToSettleOrderIds,
    },
  };
}
