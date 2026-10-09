import { Nav } from "@/components/Nav";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <Nav user={user} />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6 pb-24">{children}</main>
    </>
  );
}
