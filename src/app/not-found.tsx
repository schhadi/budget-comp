import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <main className="rise flex flex-1 flex-col justify-center px-7">
      <Icon name="explore_off" size={40} className="text-muted" />
      <h1 className="mt-6 text-[26px] leading-[1.15] font-semibold tracking-[-0.02em]">That page doesn&apos;t exist</h1>
      <Link href="/dashboard" className="btn-outline mt-6 self-start !h-11 !px-[18px]">
        Back to your leagues
      </Link>
    </main>
  );
}
