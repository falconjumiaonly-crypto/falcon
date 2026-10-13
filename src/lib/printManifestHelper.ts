/**
 * Falcon Delivery Manifest Print Engine
 * Provides dual reliable printing:
 * 1. Dedicated print window/tab via /print/manifest (immune to modal overflow/blank screen)
 * 2. Offscreen isolated iframe printer with full standalone CSS styling
 */

export interface PrintManifestOptions {
  title?: string;
  fallbackUrl?: string;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

/**
 * Opens the dedicated manifest print page in a clean new tab/window.
 * This guarantees 100% reliable printing on all browsers without modal clipping.
 */
export function openManifestPrintPage(
  orderIds: string[],
  meta: {
    carrierName?: string;
    driverName?: string;
    driverPhone?: string;
    autoPrint?: boolean;
  } = {}
) {
  if (typeof window === "undefined" || orderIds.length === 0) return;

  const params = new URLSearchParams();
  params.set("ids", orderIds.join(","));
  if (meta.carrierName) params.set("carrier", meta.carrierName);
  if (meta.driverName) params.set("driver", meta.driverName);
  if (meta.driverPhone) params.set("phone", meta.driverPhone);
  if (meta.autoPrint !== false) params.set("auto", "1");

  const url = `/print/manifest?${params.toString()}`;
  const win = window.open(url, "_blank");
  if (!win) {
    // If popup was blocked by browser, navigate in same window
    window.location.href = url;
  }
}

/**
 * Isolated in-page printer using a fully rendered, off-screen iframe with self-contained styles.
 */
export function printManifestIsolated(
  elementOrId: HTMLElement | string,
  options?: PrintManifestOptions
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof window === "undefined" || typeof document === "undefined") {
        resolve(false);
        return;
      }

      // If fallbackUrl provided and user is in a strict environment, open window directly
      if (options?.fallbackUrl) {
        const opened = window.open(options.fallbackUrl, "_blank");
        if (opened) {
          options?.onBeforePrint?.();
          options?.onAfterPrint?.();
          resolve(true);
          return;
        }
      }

      const targetElement =
        typeof elementOrId === "string"
          ? document.getElementById(elementOrId)
          : elementOrId;

      if (!targetElement) {
        console.warn("[Falcon Print] Target element not found");
        if (options?.fallbackUrl) {
          window.location.href = options.fallbackUrl;
        } else {
          window.print();
        }
        resolve(false);
        return;
      }

      const manifestHtml = targetElement.innerHTML;
      const docTitle =
        options?.title || "كشف وبيان تسليم الشحنات لمندوب الشحن - Falcon";

      // Create an off-screen iframe with REAL dimensions (not 0x0)
      const iframeId = "falcon-delivery-manifest-print-frame";
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }

      iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.style.position = "fixed";
      iframe.style.top = "-9999px";
      iframe.style.left = "-9999px";
      iframe.style.width = "1024px";
      iframe.style.height = "1400px";
      iframe.style.border = "none";
      iframe.style.opacity = "0.01";
      iframe.style.pointerEvents = "none";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!frameDoc || !iframe.contentWindow) {
        if (options?.fallbackUrl) {
          window.location.href = options.fallbackUrl;
        } else {
          window.print();
        }
        resolve(false);
        return;
      }

      // Gather ONLY external font/stylesheet links (NEVER destructive page styles)
      const linkNodes = Array.from(
        document.querySelectorAll('link[rel="stylesheet"]')
      );
      const linksHtml = linkNodes.map((node) => node.outerHTML).join("\n");

      frameDoc.open();
      frameDoc.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  ${linksHtml}
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 6mm;
    }
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: var(--font-cairo), Cairo, Tahoma, Arial, sans-serif !important;
      direction: rtl !important;
      text-align: right !important;
      width: 100% !important;
      font-size: 11px !important;
    }
    #manifest-standalone-wrapper {
      width: 100% !important;
      padding: 6mm 4mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      display: block !important;
      direction: rtl !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important;
      font-size: 10.5px !important;
      margin-bottom: 16px !important;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th, td {
      border: 1px solid #000000 !important;
      padding: 4px 6px !important;
      color: #000000 !important;
    }
    .manifest-signatures {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      border: 1px solid #000000 !important;
      padding: 12px !important;
      margin-top: 14px !important;
      border-radius: 6px !important;
    }
    .no-print, .no-print-manifest {
      display: none !important;
    }
  </style>
</head>
<body dir="rtl">
  <div id="manifest-standalone-wrapper" dir="rtl">
    ${manifestHtml}
  </div>
</body>
</html>`);
      frameDoc.close();

      const frameWindow = iframe.contentWindow;
      options?.onBeforePrint?.();

      const runPrint = () => {
        try {
          frameWindow.focus();
          frameWindow.print();
          options?.onAfterPrint?.();
          resolve(true);
        } catch (err) {
          console.error("[Falcon Print] Frame print error:", err);
          if (options?.fallbackUrl) {
            window.open(options.fallbackUrl, "_blank");
          } else {
            window.print();
          }
          resolve(false);
        } finally {
          setTimeout(() => {
            try {
              if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            } catch {}
          }, 3500);
        }
      };

      if (frameDoc.readyState === "complete") {
        setTimeout(runPrint, 300);
      } else {
        iframe.onload = () => setTimeout(runPrint, 300);
      }
    } catch (err) {
      console.error("[Falcon Print] Error in printManifestIsolated:", err);
      if (options?.fallbackUrl) {
        window.open(options.fallbackUrl, "_blank");
      } else {
        window.print();
      }
      resolve(false);
    }
  });
}
