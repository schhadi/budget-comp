import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <main className="flex flex-1 flex-col">{children}</main>;
}
