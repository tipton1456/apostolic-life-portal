"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HeaderBackLink() {
  const pathname = usePathname();
  const backLink = getBackLink(pathname);

  if (!backLink) {
    return <div aria-hidden="true" />;
  }

  return (
    <Link
      href={backLink.href}
      className="block max-w-[7rem] truncate text-xs font-semibold text-lime-400 transition hover:text-lime-300 sm:max-w-none sm:text-sm"
    >
      {backLink.label}
    </Link>
  );
}

function getBackLink(pathname: string) {
  if (pathname === "/create-account") {
    return { href: "/login", label: "← Back to Login" };
  }

  if (pathname === "/contact/request-update") {
    return { href: "/contact", label: "← Back to Contact Information" };
  }

  if (pathname.startsWith("/groups/") && pathname !== "/groups") {
    return { href: "/groups", label: "← Back to Group Management" };
  }

  const scheduleMatch = pathname.match(
    /^\/schedule\/([^/]+)\/([^/]+)(?:\/(teams|order))?$/,
  );

  if (scheduleMatch?.[3]) {
    return {
      href: `/schedule/${scheduleMatch[1]}/${scheduleMatch[2]}`,
      label: "← Back to Service Plan",
    };
  }

  if (scheduleMatch) {
    return { href: "/dashboard", label: "← Back to Dashboard" };
  }

  if (
    [
      "/assignments",
      "/contact",
      "/events",
      "/giving",
      "/groups",
      "/prayer-board",
    ].includes(pathname)
  ) {
    return { href: "/dashboard", label: "← Back to Dashboard" };
  }

  return null;
}
