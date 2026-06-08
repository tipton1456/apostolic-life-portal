"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavigationItem = {
  href: string;
  label: string;
};

type SiteNavigationMenuProps = {
  className?: string;
  logoutAction: () => void;
  memberName: string;
  navigationItems: NavigationItem[];
  picture?: string;
};

export default function SiteNavigationMenu({
  className = "",
  logoutAction,
  memberName,
  navigationItems,
  picture,
}: SiteNavigationMenuProps) {
  const pathname = usePathname();

  return (
    <SiteNavigationMenuContent
      key={pathname}
      className={className}
      logoutAction={logoutAction}
      memberName={memberName}
      navigationItems={navigationItems}
      picture={picture}
    />
  );
}

function SiteNavigationMenuContent({
  className = "",
  logoutAction,
  memberName,
  navigationItems,
  picture,
}: SiteNavigationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (!isOpen) return;

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative z-50 ${className}`}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-neutral-950/95 px-3 py-2 text-sm font-semibold text-neutral-100 shadow-lg shadow-black/30 transition hover:border-lime-400/60 sm:px-4 sm:py-3"
      >
        {picture ? (
          <img
            src={picture}
            alt={memberName}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-400 text-xs font-bold text-neutral-950">
            {getInitials(memberName)}
          </span>
        )}
        Menu
        <span
          className={`text-lime-300 transition ${isOpen ? "rotate-180" : ""}`}
        >
          v
        </span>
      </button>

      {isOpen ? (
        <nav className="absolute right-0 mt-2 max-h-[min(75vh,34rem)] w-64 overflow-y-auto rounded-xl border border-white/10 bg-neutral-950/95 p-2 shadow-xl shadow-black/40">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="block rounded-lg px-3 py-3 text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
            >
              {item.label}
            </Link>
          ))}
          <form action={logoutAction} className="border-t border-white/10 pt-2">
            <button
              type="submit"
              onClick={() => setIsOpen(false)}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-neutral-100 transition hover:bg-white/10 hover:text-lime-300"
            >
              Logout
            </button>
          </form>
        </nav>
      ) : null}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
