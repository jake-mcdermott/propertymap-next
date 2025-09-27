// src/components/Header.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

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
  "bg-white/[0.035] backdrop-blur-md border-b border-white/10 ring-1 ring-black/20";

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

  return (
    <header className={`h-16 flex items-center px-4 sm:px-6 md:px-8 top-0 z-40 ${SURFACE}`}>
      {/* Left: Logo (hard reset) */}
      <Link
        href="/"
        onClick={handleLogoClick}
        className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/50 rounded-md"
        title="PropertyMap.ie — reset"
      >
        <Image
          src="/pmLogoWhite.svg"
          alt="PropertyMap.ie"
          width={200}
          height={28}
          priority
          className={
            minimal
              ? "opacity-95"
              : "opacity-95 hover:opacity-100 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.6)] transition"
          }
        />
      </Link>

      {/* Desktop nav */}
      <nav className="ml-auto hidden md:flex items-center gap-1 sm:gap-2 md:gap-4 text-[14px] font-medium tracking-tight">
        <NavLink href="/" minimal={minimal}>
          Map
        </NavLink>
        <NavLink href="/insights" minimal={minimal}>
          Insights
        </NavLink>
        <NavLink href="/mortgage-calculator" minimal={minimal}>
          Mortgage Calculator
        </NavLink>
        <NavLink href="/contact" minimal={minimal}>
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
              className="text-slate-300 hover:text-white hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="bg-neutral-950 border-neutral-800 text-slate-200">
            <SheetHeader>
              <SheetTitle className="text-slate-200">PropertyMap</SheetTitle>
            </SheetHeader>

            <div className="mt-4 flex flex-col">
              <MobileItem href="/">Map</MobileItem>
              <MobileItem href="/insights">Insights</MobileItem>
              <MobileItem href="/mortgage-calculator">Mortgage Calculator</MobileItem>
              <MobileItem href="/contact">Contact</MobileItem>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

/* Subcomponents */
function NavLink({
  href,
  children,
  minimal = false,
}: {
  href: string;
  children: React.ReactNode;
  minimal?: boolean;
}) {
  const base = "px-3 py-1.5 rounded-md";
  if (minimal) {
    return (
      <Link href={href} className={`${base} text-slate-300`}>
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} text-slate-300 hover:text-white hover:underline underline-offset-4 decoration-white/50 transition-colors duration-200`}
    >
      {children}
    </Link>
  );
}

function MobileItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
        className="block px-2 py-3 rounded-md text-[15px] font-medium hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        {children}
      </Link>
    </SheetClose>
  );
}
