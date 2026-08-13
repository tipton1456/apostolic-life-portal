"use client";

import { useState } from "react";
import type { VanPlanItemImage } from "@/lib/van-plan/types";

export default function VanPlanItemGallery({
  images,
  itemName,
}: {
  images: VanPlanItemImage[];
  itemName: string;
}) {
  const initial = images.find((image) => image.isPrimary) ?? images[0];
  const [activeId, setActiveId] = useState(initial?.id ?? "");
  const active = images.find((image) => image.id === activeId) ?? initial;

  if (!active) {
    return (
      <div className="vp-card flex aspect-square items-center justify-center">
        <p className="vp-accent">no photos yet</p>
      </div>
    );
  }

  return (
    <div>
      <div className="vp-card overflow-hidden">
        {/* Dynamic auction images are served by the module route. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.url}
          alt={itemName}
          className="aspect-square w-full object-cover"
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveId(image.id)}
              aria-label={`Show photo ${index + 1} of ${itemName}`}
              aria-pressed={image.id === active.id}
              className={`overflow-hidden rounded-xl border ${
                image.id === active.id
                  ? "border-[#75871F]"
                  : "border-[rgba(70,67,60,0.14)]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt=""
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
