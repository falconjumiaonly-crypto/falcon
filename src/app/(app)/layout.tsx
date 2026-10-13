"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { WebMcpProvider } from "@/components/webmcp/WebMcpProvider";

const WebMcpInspectorModal = dynamic(
  () => import("@/components/webmcp/WebMcpInspectorModal").then((m) => m.WebMcpInspectorModal),
  { ssr: false }
);

const MerchantCopilotWidget = dynamic(
  () => import("@/components/copilot/MerchantCopilotWidget").then((m) => m.MerchantCopilotWidget),
  { ssr: false }
);

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <WebMcpProvider>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Right-side RTL Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:mr-64 transition-all duration-200 print:mr-0 print:w-full">
          <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
          <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto print:p-0 print:m-0 print:max-w-none">
            {children}
          </main>
        </div>

        {/* In-Browser WebMCP AI Inspector Tool */}
        <WebMcpInspectorModal />

        {/* AI Merchant Copilot Floating Widget */}
        <MerchantCopilotWidget />
      </div>
    </WebMcpProvider>
  );
}
