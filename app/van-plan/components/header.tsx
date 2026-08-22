import Image from "next/image";
import Link from "next/link";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";

export default function VanPlanHeader() {
  return (
    <header className="overflow-hidden bg-[#F9EDE4]">
      <Link href={VAN_PLAN_BASE_PATH} className="block">
        <Image
          src="/NewestVanPlanHeader.jpg"
          alt="The Great Van Plan Silent Auction"
          width={2658}
          height={984}
          unoptimized
          preload
          className="h-auto w-full"
        />
      </Link>
    </header>
  );
}
