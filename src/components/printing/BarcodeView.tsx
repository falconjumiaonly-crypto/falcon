"use client";

import React, { useMemo } from "react";
import { generateBarcodeSvg } from "@/lib/barcode";

interface BarcodeViewProps {
  value: string;
  height?: number;
  moduleWidth?: number;
  showText?: boolean;
  className?: string;
}

export function BarcodeView({
  value,
  height = 42,
  moduleWidth = 1.6,
  showText = true,
  className = "",
}: BarcodeViewProps) {
  const svgHtml = useMemo(() => {
    if (!value) return "";
    return generateBarcodeSvg(value, {
      height,
      moduleWidth,
      showText,
      quietZone: true,
    });
  }, [value, height, moduleWidth, showText]);

  if (!svgHtml) return null;

  return (
    <div
      className={`inline-block select-none ${className}`}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
