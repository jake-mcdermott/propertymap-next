// src/components/Header.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  Map as MapIcon,
  BarChart3,
  Calculator,
  Mail,
  ChevronRight,
  Handshake,
} from "lucide-react";
import { useEffect, useState } from "react";

// shadcn/ui
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const SURFACE =
  "bg-[rgba(12,12,13,0.55)] backdrop-blur-xl border-b border-white/10 ring-1 ring-black/30";

export default function Header() {
  const pathname = usePathname();
  const minimal = pathname === "/contact" || pathname === "/feedback";

  function handleLogoClick(e: MouseEvent) {
    e.preventDefault();
    try {
      localStorage.removeItem("pm:filters");
      localStorage.removeItem("pm:map");
      sessionStorage.removeItem("pm:ui");
    } catch {}
    window.location.assign("/");
  }

  function RotatingEmoji() {
    const icons = ["❤️", "💪", "🧙", "✨", "🔥", "🦧", "🤠"];
    const [i, setI] = useState(0);
  
    useEffect(() => {
      const id = setInterval(() => setI((n) => (n + 1) % icons.length), 1200);
      return () => clearInterval(id);
    }, []);
  
    return (
      <span aria-hidden className="inline-block w-4 text-center align-[-0.1em]">
        {icons[i]}
      </span>
    );
  }
  
  function MobileSheetFooter() {
    return (
      <div className="pointer-events-auto absolute left-0 right-0 bottom-0 z-10">
        {/* soft fade into content */}
        <div
          className="h-6 bg-gradient-to-t from-black/70 via-black/40 to-transparent"
          aria-hidden
        />
        <div className="backdrop-blur-md bg-black/60 border-t border-white/10 px-4 pt-2 pb-[max(14px,env(safe-area-inset-bottom))]">
          <p className="text-[11px] text-white/55">
            Made with <RotatingEmoji /> in Ireland 🇮🇪 • © 2025 PropertyMap.ie
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <header
      className={`h-16 sticky top-0 z-40 flex items-center px-4 sm:px-6 md:px-8 ${SURFACE}`}
      role="banner"
    >
      {/* Left: Logo (hard reset) */}
      <Link
        href="/"
        onClick={handleLogoClick}
        className="group flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50"
        title="PropertyMap.ie — reset"
        aria-label="PropertyMap.ie home"
      >
        <Image
          src="/pmLogoWhite.svg"
          alt="PropertyMap.ie"
          width={180}
          height={26}
          priority
          className={
            minimal
              ? "opacity-95"
              : "opacity-95 group-hover:opacity-100 transition-opacity"
          }
        />
      </Link>

      {/* Desktop nav */}
      <nav
        className="ml-auto hidden md:flex items-center gap-1 sm:gap-2 md:gap-4 text-[14px] font-medium tracking-tight"
        aria-label="Primary"
      >
        <NavLink href="/" current={pathname === "/"} minimal={minimal}>
          Map
        </NavLink>
        <NavLink href="/insights" current={pathname === "/insights"} minimal={minimal}>
          Insights
        </NavLink>
        <NavLink
          href="/mortgage-calculator"
          current={pathname === "/mortgage-calculator"}
          minimal={minimal}
        >
          Mortgage Calculator
        </NavLink>
        <NavLink href="/agents" current={pathname === "/agents"} minimal={minimal}>
          Agents
        </NavLink>
        <NavLink href="/contact" current={pathname === "/contact"} minimal={minimal}>
          Contact
        </NavLink>
      </nav>

      {/* Mobile hamburger */}
      <div className="ml-auto md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              className="relative h-10 w-10 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 active:scale-[0.98] transition"
            >
              <Menu className="h-5 w-5" />
              {/* subtle ring on focus */}
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-0 focus-within:ring-2 focus-within:ring-white/40" />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="w-[84vw] sm:w-[380px] bg-neutral-950/98 border-neutral-800 text-slate-200 p-0"
            aria-label="Mobile navigation"
          >
            {/* Header area with logo */}
            <SheetHeader className="px-4 pt-4 pb-3 border-b border-white/10 bg-black/30">
              <SheetTitle className="flex items-center gap-2 text-slate-100">
                <Image
                  src="/pmLogoWhite.svg"
                  alt="PropertyMap.ie"
                  width={150}
                  height={22}
                  priority
                  className="opacity-95"
                />
              </SheetTitle>
            </SheetHeader>

            {/* Nav list */}
            <div className="py-2">
              <MobileItem href="/" icon={<MapIcon className="h-4.5 w-4.5" />}>
                Map
              </MobileItem>
              <Divider />
              <MobileItem
                href="/insights"
                icon={<BarChart3 className="h-4.5 w-4.5" />}
              >
                Insights
              </MobileItem>
              <Divider />
              <MobileItem
                href="/mortgage-calculator"
                icon={<Calculator className="h-4.5 w-4.5" />}
              >
                Mortgage Calculator
              </MobileItem>
              <Divider />
              <MobileItem href="/agents" icon={<Handshake className="h-4.5 w-4.5" />}>
                Agents
              </MobileItem>
              <Divider />
              <MobileItem href="/contact" icon={<Mail className="h-4.5 w-4.5" />}>
                Contact
              </MobileItem>
            </div>

            <MobileSheetFooter />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

/* ---------- Subcomponents ---------- */

function NavLink({
  href,
  children,
  minimal = false,
  current = false,
}: {
  href: string;
  children: React.ReactNode;
  minimal?: boolean;
  current?: boolean;
}) {
  const base =
    "px-3 py-1.5 rounded-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30";
  const active =
    "text-white underline underline-offset-4 decoration-white/60";
  const hover = "text-slate-200 hover:text-white hover:underline underline-offset-4 decoration-white/40";
  const plain = "text-slate-300";
  const cls = minimal ? `${base} ${plain}` : `${base} ${current ? active : hover}`;

  return (
    <Link href={href} className={cls} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

function Divider() {
  return <div className="mx-4 my-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />;
}

function MobileItem({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
        className="group flex items-center justify-between gap-3 px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] ring-1 ring-white/10 text-white/90 group-hover:bg-white/[0.08] transition">
            {icon}
          </span>
          <span className="text-[15px] font-medium text-slate-200 group-hover:text-white transition-colors">
            {children}
          </span>
        </span>
        <ChevronRight className="h-4.5 w-4.5 text-white/30 group-hover:text-white/60 transition" />
      </Link>
    </SheetClose>
  );
}
