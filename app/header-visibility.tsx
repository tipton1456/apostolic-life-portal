"use client";

import { usePathname } from "next/navigation";

export default function HeaderVisibility({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/login" || pathname === "/change-password") {
    return null;
  }

  return children;
}
