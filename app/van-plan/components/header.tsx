import Image from "next/image";
import Link from "next/link";
import { VAN_PLAN_BASE_PATH } from "@/lib/van-plan/constants";

export default function VanPlanHeader() {
  return (
    <header className="overflow-hidden bg-[#F9EDE4]">
      <Link href={VAN_PLAN_BASE_PATH} className="block">
        <Image
          src="/VanPlanHeader.jpg"
          alt="The Great Van Plan Silent Auction"
          width={1920}
          height={480}
          priority
          className="h-auto w-full object-cover object-center"
        />
      </Link>
    </header>
  );
}
