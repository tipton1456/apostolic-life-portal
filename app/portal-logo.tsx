import Image from "next/image";
import Link from "next/link";

export default function PortalLogo({
  className = "h-auto w-72 max-w-full",
}: {
  className?: string;
}) {
  return (
    <Link href="/dashboard" className="inline-flex">
      <Image
        src="/apostolic-life-white.png"
        alt="Apostolic Life Tupelo Mississippi"
        width={1786}
        height={535}
        priority
        className={className}
      />
    </Link>
  );
}
