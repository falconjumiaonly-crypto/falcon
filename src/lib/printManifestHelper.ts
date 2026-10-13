/**
 * Falcon Delivery Manifest Print Helper
 * Provides isolated, clean A4 printing for courier delivery manifests without
 * blank screen issues, overflow clipping, or modal unmounting race conditions.
 */

export interface PrintManifestOptions {
  title?: string;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

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

      const targetElement =
        typeof elementOrId === "string"
          ? document.getElementById(elementOrId)
          : elementOrId;

      if (!targetElement) {
        console.warn(
          "[Falcon Print] Manifest target element not found, falling back to window.print()"
        );
        window.print();
        resolve(false);
        return;
      }

      // 1. Collect all loaded stylesheets and style blocks from current page
      const styleNodes = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style')
      );
      const stylesHtml = styleNodes.map((node) => node.outerHTML).join("\n");

      // 2. Extract the rendered manifest content
      const manifestHtml = targetElement.innerHTML;
      const docTitle =
        options?.title || "كشف وبيان تسليم الشحنات لمندوب الشحن - Falcon";

      // 3. Create or reuse hidden iframe
      const iframeId = "falcon-delivery-manifest-print-frame";
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }

      iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.visibility = "hidden";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!frameDoc || !iframe.contentWindow) {
        console.warn(
          "[Falcon Print] Failed to access iframe document, fallback to window.print()"
        );
        window.print();
        resolve(false);
        return;
      }

      // 4. Build complete standalone printable A4 document
      frameDoc.open();
      frameDoc.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  ${stylesHtml}
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
      font-family: var(--font-cairo), Cairo, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
      direction: rtl !important;
      text-align: right !important;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
      font-size: 11px !important;
    }
    #manifest-standalone-wrapper {
      width: 100% !important;
      margin: 0 !important;
      padding: 4mm !important;
      background: #ffffff !important;
      color: #000000 !important;
      direction: rtl !important;
      text-align: right !important;
    }
    .no-print, .no-print-manifest {
      display: none !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important;
      font-size: 10.5px !important;
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
      margin-top: 10px !important;
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

      const executePrint = () => {
        try {
          frameWindow.focus();
          frameWindow.print();
          options?.onAfterPrint?.();
          resolve(true);
        } catch (err) {
          console.error("[Falcon Print] Error executing iframe print:", err);
          window.print();
          resolve(false);
        } finally {
          // Cleanup iframe after print dialogue closes
          setTimeout(() => {
            try {
              if (iframe && iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
            } catch {}
          }, 3000);
        }
      };

      // Allow fonts and styles to settle
      if (frameDoc.readyState === "complete") {
        setTimeout(executePrint, 250);
      } else {
        iframe.onload = () => setTimeout(executePrint, 250);
      }
    } catch (error) {
      console.error("[Falcon Print] Unexpected error in printManifestIsolated:", error);
      window.print();
      resolve(false);
    }
  });
}
