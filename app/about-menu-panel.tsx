"use client";

import Image from "next/image";
import { useEffect } from "react";

const INTEGRATION_LOGOS = [
  { alt: "Tithe.ly", src: "/integrations/tithely.svg" },
  { alt: "Elvanto", src: "/integrations/elvanto.svg" },
  { alt: "Planning Center", src: "/integrations/planning-center.svg" },
  { alt: "Supabase", src: "/integrations/supabase.svg" },
  { alt: "Twilio", src: "/integrations/twilio.svg" },
  { alt: "Cognito Forms", src: "/integrations/cognito-forms.svg" },
  { alt: "GroupMe", src: "/integrations/groupme.svg" },
  { alt: "Vercel", src: "/integrations/vercel.svg" },
] as const;

export default function AboutMenuPanel({
  version,
  onClose,
}: {
  version: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close about panel"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-950/75 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-menu-title"
        className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl shadow-black/50 sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-neutral-300 transition hover:border-lime-300/40 hover:text-lime-300"
        >
          ×
        </button>

        <div className="flex justify-center pt-2">
          <Image
            src="/apostolic-life-white.png"
            alt="Apostolic Life"
            width={1786}
            height={535}
            className="h-auto w-56 max-w-full"
          />
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <p
            id="about-menu-title"
            className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500"
          >
            Connected Products
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {INTEGRATION_LOGOS.map((logo) => (
              <div
                key={logo.alt}
                className="flex min-h-16 items-center justify-center rounded-xl border border-white/10 bg-neutral-900/70 px-3 py-3"
              >
                <img
                  src={logo.src}
                  alt={logo.alt}
                  className="h-8 w-full max-w-[7.5rem] object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center font-sans text-base italic text-lime-300">
          Creating a place where Apostolic Life can find all their data
        </p>

        <p className="mt-6 text-center text-sm text-neutral-400">
          &copy; Apostolic Life UPCI Tech
        </p>

        <p className="mt-3 text-center text-xs font-semibold tracking-[0.18em] text-neutral-500">
          {version}
        </p>
      </div>
    </div>
  );
}