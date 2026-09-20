"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export const DRAFT_STORAGE_KEY = "falcon_order_form_draft_v1";

export interface OrderFormData {
  customer_name: string;
  phone_primary: string;
  phone_secondary: string;
  governorate: string;
  address: string;
  landmark: string;
  order_total: string;
  paid_amount: string;
  shipping_cost: string;
  important_notes: string;
  order_date: string;
}

export const defaultInitialFormData: OrderFormData = {
  customer_name: "",
  phone_primary: "",
  phone_secondary: "",
  governorate: "",
  address: "",
  landmark: "",
  order_total: "",
  paid_amount: "0",
  shipping_cost: "",
  important_notes: "",
  order_date: new Date().toISOString().split("T")[0],
};

export function useOrderDraft() {
  const [formData, setFormData] = useState<OrderFormData>(defaultInitialFormData);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const currentDataRef = useRef<OrderFormData>(defaultInitialFormData);

  // Keep ref up to date for synchronous lifecycle flushes
  useEffect(() => {
    currentDataRef.current = formData;
  }, [formData]);

  // Synchronous flush to persistent storage
  const persistData = useCallback((data: OrderFormData) => {
    const hasMeaningfulContent =
      Boolean(data.customer_name?.trim()) ||
      Boolean(data.phone_primary?.trim()) ||
      Boolean(data.governorate?.trim()) ||
      Boolean(data.address?.trim()) ||
      Boolean(data.order_total?.trim()) ||
      Boolean(data.important_notes?.trim());

    if (!hasMeaningfulContent) return;

    try {
      const payload = {
        data,
        savedAt: new Date().toISOString(),
      };
      const serialized = JSON.stringify(payload);
      localStorage.setItem(DRAFT_STORAGE_KEY, serialized);
      // Secondary fallback for high-reliability tab recovery
      sessionStorage.setItem(DRAFT_STORAGE_KEY, serialized);
      setLastSavedAt(new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {
      // Storage fallback or quota exceptions handled gracefully
    }
  }, []);

  // Restore draft on initial mount
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(DRAFT_STORAGE_KEY) || sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        const restored = parsed.data || parsed;
        if (restored && typeof restored === "object") {
          // Check if restored object actually contains user data
          const hasContent = Object.values(restored).some(
            (v) => typeof v === "string" && v.trim() !== "" && v !== "0" && v !== defaultInitialFormData.order_date
          ) || Boolean(restored.customer_name?.trim());

          if (hasContent) {
            setFormData((prev) => ({
              ...prev,
              ...restored,
            }));
            setHasRestoredDraft(true);
            if (parsed.savedAt) {
              setLastSavedAt(new Date(parsed.savedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }));
            }
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }, []);

  // Debounced auto-save on change
  useEffect(() => {
    const timer = setTimeout(() => {
      persistData(formData);
    }, 400);

    return () => clearTimeout(timer);
  }, [formData, persistData]);

  // Flush immediately on tab switch, backgrounding, or leaving app
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistData(currentDataRef.current);
      }
    };

    const handlePageHide = () => {
      persistData(currentDataRef.current);
    };

    const handleBeforeUnload = () => {
      persistData(currentDataRef.current);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [persistData]);

  // Clear draft explicitly upon successful order completion or user discard
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setFormData(defaultInitialFormData);
    setHasRestoredDraft(false);
    setLastSavedAt(null);
  }, []);

  const updateField = useCallback((field: keyof OrderFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  return {
    formData,
    updateField,
    setFormData,
    clearDraft,
    hasRestoredDraft,
    lastSavedAt,
  };
}
