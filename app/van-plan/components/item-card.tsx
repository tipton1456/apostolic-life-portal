import Link from "next/link";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";
import { formatUsd, toProperCase } from "@/lib/van-plan/format";
import { primaryItemImage } from "@/lib/van-plan/items";
import type { VanPlanItem } from "@/lib/van-plan/types";

export default function VanPlanItemCard({
  item,
  statusLabel,
}: {
  item: VanPlanItem;
  statusLabel: string;
}) {
  const image = primaryItemImage(item);
  const description = toProperCase(item.description);
  const hasBid = Boolean(item.highestBid);
  const bidCents = item.highestBid?.amountCents ?? item.startingPriceCents;
  const showReadMore = description.length > 70;

  return (
    <Link
      href={`${VAN_PLAN_BASE_PATH}/items/${item.slug}`}
      className="vp-card flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5"
    >
      <div className="aspect-square bg-white/40 sm:aspect-[4/3]">
        {image ? (
          // Dynamic auction images are served by the module route.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="vp-accent text-[11px] sm:text-sm">no photo yet</p>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-5">
        <p className="vp-accent text-[10px] sm:text-xs">{statusLabel}</p>
        <h2 className="vp-heading-bold mt-1 line-clamp-2 text-[13px] leading-4 sm:mt-2 sm:text-xl sm:leading-7">
          {item.name}
        </h2>
        <p className="vp-description mt-2 line-clamp-2 text-[11px] leading-4 sm:mt-3 sm:text-sm sm:leading-6">
          {description}
        </p>
        {showReadMore ? (
          <p className="vp-accent mt-1 text-[10px] sm:text-xs">read more</p>
        ) : null}

        <div className="mt-auto pt-2 sm:pt-4">
          <p className="vp-subhead text-[10px] sm:text-sm">
            {hasBid ? "current bid" : "starting bid"}
          </p>
          <p className="vp-heading-bold mt-0.5 text-sm sm:mt-1 sm:text-xl">
            {formatUsd(bidCents)}
          </p>
        </div>
      </div>
    </Link>
  );
}
