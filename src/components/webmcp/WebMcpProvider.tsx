"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createWebMcpRuntime,
  FalconWebMcp,
  FalconWebMcpState,
} from "@/lib/webmcp/webmcpClient";

interface WebMcpContextValue {
  mcp: FalconWebMcp | null;
  state: FalconWebMcpState;
  executeTool: (name: string, params?: any) => Promise<any>;
  registerPageAction: (name: string, handler: (params?: any) => any, description?: string) => void;
  unregisterPageAction: (name: string) => void;
  updatePageState: (partial: Partial<FalconWebMcpState>) => void;
}

const WebMcpContext = createContext<WebMcpContextValue | null>(null);

export function useWebMcp() {
  const context = useContext(WebMcpContext);
  if (!context) {
    throw new Error("useWebMcp must be used within a WebMcpProvider");
  }
  return context;
}

interface WebMcpProviderProps {
  children: React.ReactNode;
}

export function WebMcpProvider({ children }: WebMcpProviderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [pageState, setPageState] = useState<Partial<FalconWebMcpState>>({
    currentPath: pathname,
    visibleCount: 0,
    selectedCount: 0,
    selectedIds: [],
    activeFilters: {},
    isReady: true,
  });

  const mcp = useMemo(() => {
    return createWebMcpRuntime(() => ({
      currentPath: pathname,
      ...pageState,
      timestamp: new Date().toISOString(),
    }));
  }, [pathname, pageState]);

  // Update path in WebMCP whenever route changes
  useEffect(() => {
    setPageState((prev) => ({ ...prev, currentPath: pathname }));
  }, [pathname]);

  // Register interactive browser actions
  useEffect(() => {
    if (!mcp) return;

    // 1. Navigation Action
    mcp.registerAction(
      "navigate_page",
      (params: { route: string }) => {
        if (params?.route) {
          router.push(params.route);
          return { success: true, route: params.route };
        }
        return { success: false, error: "Missing route" };
      },
      "التنقل في صفحات النظام (/orders, /print/queue, /settlements, /dashboard, /inventory, /settings)"
    );

    // 2. Select All Orders in Active Table
    mcp.registerAction(
      "select_all_orders",
      () => {
        const selectAllBtn = document.querySelector<HTMLButtonElement>(
          'button[aria-label="تحديد الكل"], button[data-webmcp-action="select-all"]'
        );
        if (selectAllBtn) {
          selectAllBtn.click();
          return { success: true, message: "تم النقر على زر تحديد الكل بنجاح" };
        }
        return { success: false, message: "زر تحديد الكل غير متوفر في الصفحة الحالية" };
      },
      "تحديد جميع الأوردرات والشحنات المعروضة في الصفحة الحالية"
    );

    // 3. Clear Order Selection
    mcp.registerAction(
      "clear_selection",
      () => {
        const clearBtn = document.querySelector<HTMLButtonElement>(
          'button[title="إلغاء التحديد"], button[data-webmcp-action="clear-selection"]'
        );
        if (clearBtn) {
          clearBtn.click();
          return { success: true, message: "تم إلغاء التحديد بنجاح" };
        }
        return { success: false, message: "لا يوجد أوردرات محددة لإلغائها" };
      },
      "إلغاء تحديد كافة الأوردرات المحددة حالياً"
    );

    // 4. Open Delivery Manifest Modal
    mcp.registerAction(
      "open_manifest_modal",
      () => {
        const manifestBtn = document.querySelector<HTMLButtonElement>(
          'button[data-webmcp-action="bulk-manifest"], button[title*="مانيفست"]'
        );
        if (manifestBtn) {
          manifestBtn.click();
          return { success: true, message: "تم فتح نافذة مانيفست التسليم A4 بنجاح" };
        }
        return { success: false, message: "يرجى تحديد أوردر واحد على الأقل لفتح المانيفست" };
      },
      "فتح كشف مانيفست تسليم الشحنات A4 للمندوب للأوردرات المحددة"
    );

    // 5. Open WhatsApp Notification Modal
    mcp.registerAction(
      "open_whatsapp_modal",
      () => {
        const waBtn = document.querySelector<HTMLButtonElement>(
          'button[data-webmcp-action="bulk-whatsapp"], button[title*="واتساب"]'
        );
        if (waBtn) {
          waBtn.click();
          return { success: true, message: "تم فتح نافذة إرسال إشعارات الواتساب بنجاح" };
        }
        return { success: false, message: "يرجى تحديد أوردر واحد على الأقل لإرسال الواتساب" };
      },
      "فتح نافذة إرسال رسائل التتبع عبر واتساب للأوردرات المحددة"
    );

    // 6. Open Barcode Handover Scanner
    mcp.registerAction(
      "open_barcode_scanner",
      () => {
        const scanBtn = document.querySelector<HTMLButtonElement>(
          'button[data-webmcp-action="open-scanner"]'
        );
        if (scanBtn) {
          scanBtn.click();
          return { success: true, message: "تم فتح ماسح الباركود بنجاح" };
        }
        return { success: false, message: "زر ماسح الباركود غير متوفر بالصفحة" };
      },
      "فتح ماسح الباركود السريع لتسليم الشحنات لمندوب الشحن"
    );

    // 7. Get Visible Table Data in Structured JSON
    mcp.registerAction(
      "get_visible_table_data",
      () => {
        const rows = document.querySelectorAll<HTMLTableRowElement>("tbody tr");
        const data: any[] = [];
        rows.forEach((row, idx) => {
          const cells = row.querySelectorAll<HTMLTableCellElement>("td");
          if (cells.length >= 6) {
            data.push({
              index: idx + 1,
              text: row.innerText.replace(/\n+/g, " | ").trim(),
            });
          }
        });
        return {
          totalRows: data.length,
          data,
        };
      },
      "استخراج وقراءة بيانات الجدول النشط في الصفحة بصيغة JSON مهيكلة للذكاء الاصطناعي"
    );

    // Listen for custom external WebMCP commands from browser extensions
    const handleCustomCommand = async (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string; params?: any }>;
      if (customEvent.detail?.action) {
        try {
          await mcp.executeTool(customEvent.detail.action, customEvent.detail.params);
        } catch (err) {
          console.error("[WebMCP] Error executing external command:", err);
        }
      }
    };

    window.addEventListener("falcon:webmcp:command", handleCustomCommand);
    return () => {
      window.removeEventListener("falcon:webmcp:command", handleCustomCommand);
    };
  }, [mcp, router]);

  const executeTool = async (name: string, params?: any) => {
    if (!mcp) throw new Error("WebMCP runtime not initialized");
    return mcp.executeTool(name, params);
  };

  const registerPageAction = (name: string, handler: (params?: any) => any, description?: string) => {
    mcp?.registerAction(name, handler, description);
  };

  const unregisterPageAction = (name: string) => {
    mcp?.unregisterAction(name);
  };

  const updatePageState = (partial: Partial<FalconWebMcpState>) => {
    setPageState((prev) => ({ ...prev, ...partial }));
  };

  const currentState = mcp ? mcp.getState() : {
    currentPath: pathname,
    visibleCount: 0,
    selectedCount: 0,
    selectedIds: [],
    activeFilters: {},
    isReady: false,
    timestamp: new Date().toISOString(),
  };

  return (
    <WebMcpContext.Provider
      value={{
        mcp,
        state: currentState,
        executeTool,
        registerPageAction,
        unregisterPageAction,
        updatePageState,
      }}
    >
      {children}
    </WebMcpContext.Provider>
  );
}
