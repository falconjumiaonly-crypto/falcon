/**
 * Falcon Shipping - In-Browser WebMCP Integration Runtime
 * Enables browser-based AI agents, extensions, and subagents to interact
 * with the Falcon Shipping web application semantically and programmatically.
 */

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<any> | any;
}

export interface FalconWebMcpState {
  currentPath: string;
  visibleCount: number;
  selectedCount: number;
  selectedIds: string[];
  activeFilters: Record<string, any>;
  isReady: boolean;
  timestamp: string;
}

export interface FalconWebMcp {
  version: string;
  tools: Record<string, WebMcpToolDefinition>;
  getState: () => FalconWebMcpState;
  executeTool: (name: string, params?: any) => Promise<any>;
  listTools: () => { name: string; description: string; parameters: any }[];
  registerAction: (name: string, handler: (params?: any) => any, description?: string, parameters?: any) => void;
  unregisterAction: (name: string) => void;
  emitEvent: (eventType: string, payload?: any) => void;
  on: (eventType: string, callback: (payload: any) => void) => () => void;
}

declare global {
  interface Window {
    __FALCON_WEBMCP__?: FalconWebMcp;
  }
}

/**
 * Creates and initializes the in-browser WebMCP runtime
 */
export function createWebMcpRuntime(
  initialStateProvider?: () => Partial<FalconWebMcpState>
): FalconWebMcp {
  const tools: Record<string, WebMcpToolDefinition> = {};
  const listeners: Record<string, ((payload: any) => void)[]> = {};

  const emitEvent = (eventType: string, payload?: any) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(`falcon:webmcp:${eventType}`, { detail: payload })
      );
    }
    const handlers = listeners[eventType] || [];
    handlers.forEach((h) => {
      try {
        h(payload);
      } catch (err) {
        console.error(`[WebMCP] Error in listener for ${eventType}:`, err);
      }
    });
  };

  const on = (eventType: string, callback: (payload: any) => void) => {
    if (!listeners[eventType]) listeners[eventType] = [];
    listeners[eventType].push(callback);
    return () => {
      listeners[eventType] = (listeners[eventType] || []).filter((cb) => cb !== callback);
    };
  };

  const registerAction = (
    name: string,
    handler: (params?: any) => any,
    description = "إجراء تفاعلي في واجهة المتصفح",
    parameters = {}
  ) => {
    tools[name] = {
      name,
      description,
      parameters,
      handler,
    };
    emitEvent("tool_registered", { name });
  };

  const unregisterAction = (name: string) => {
    delete tools[name];
    emitEvent("tool_unregistered", { name });
  };

  const listTools = () => {
    return Object.values(tools).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  };

  const executeTool = async (name: string, params: any = {}) => {
    const tool = tools[name];
    if (!tool) {
      throw new Error(`WebMCP: Tool "${name}" is not registered on the active page.`);
    }
    emitEvent("tool_executing", { name, params });
    try {
      const result = await tool.handler(params);
      emitEvent("tool_executed", { name, result });
      return result;
    } catch (err: any) {
      emitEvent("tool_failed", { name, error: err.message });
      throw err;
    }
  };

  const getState = (): FalconWebMcpState => {
    const partial = initialStateProvider ? initialStateProvider() : {};
    return {
      currentPath: typeof window !== "undefined" ? window.location.pathname : "/",
      visibleCount: 0,
      selectedCount: 0,
      selectedIds: [],
      activeFilters: {},
      isReady: true,
      timestamp: new Date().toISOString(),
      ...partial,
    };
  };

  // Register standard WebMCP browser tools
  registerAction(
    "navigate_to",
    (params: { path: string }) => {
      if (typeof window !== "undefined" && params?.path) {
        window.location.href = params.path;
        return { success: true, navigatedTo: params.path };
      }
      return { success: false, error: "No path specified" };
    },
    "الانتقال برمجياً إلى أي صفحة داخل النظام (/orders, /print/queue, /settlements, /dashboard, /inventory, /settings)",
    { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
  );

  registerAction(
    "get_page_kpis",
    () => {
      const state = getState();
      return {
        path: state.currentPath,
        visibleCount: state.visibleCount,
        selectedCount: state.selectedCount,
        selectedIds: state.selectedIds,
        activeFilters: state.activeFilters,
      };
    },
    "قراءة سياق الصفحة الحالية، عدد الأوردرات المعروضة، والمحددة، والفلاتر النشطة"
  );

  const runtime: FalconWebMcp = {
    version: "1.0.0",
    tools,
    getState,
    executeTool,
    listTools,
    registerAction,
    unregisterAction,
    emitEvent,
    on,
  };

  if (typeof window !== "undefined") {
    window.__FALCON_WEBMCP__ = runtime;
  }

  return runtime;
}
