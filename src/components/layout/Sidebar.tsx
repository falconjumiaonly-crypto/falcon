"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Package,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  Wallet,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  {
    name: "الرئيسية",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "إنشاء بوليصة",
    href: "/orders/create",
    icon: PlusCircle,
  },
  {
    name: "الطلبات",
    href: "/orders",
    icon: Package,
  },
  {
    name: "استيراد Excel",
    href: "/import",
    icon: FileSpreadsheet,
  },
  {
    name: "قائمة الطباعة",
    href: "/print/queue",
    icon: Printer,
  },
  {
    name: "تم الطباعة",
    href: "/print/archive",
    icon: CheckCircle2,
  },
  {
    name: "المالية والتسويات",
    href: "/finance",
    icon: Wallet,
  },
  {
    name: "الإعدادات والتكاملات",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity print:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 right-0 z-50 h-full w-64 bg-white border-l border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 print:hidden ${
          isOpen ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              <span className="text-xl">🦅</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Falcon</h1>
              <p className="text-xs text-blue-600 font-semibold tracking-wide">فلكون للشحن</p>
            </div>
          </Link>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Primary CTA */}
        <div className="p-4">
          <Link
            href="/orders/create"
            onClick={onClose}
            className="w-full h-11 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-blue-600/30 transition-colors"
          >
            <PlusCircle className="w-5 h-5 stroke-[2.5]" />
            <span>+ إنشاء بوليصة</span>
          </Link>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-blue-600" : "text-slate-400"
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User / Sign-out footer */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-5 h-5 text-rose-500" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
}
