import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="card p-6 text-center max-w-sm">
        <div className="text-4xl">🫠</div>
        <p className="mt-3 font-medium">That page doesn&apos;t exist.</p>
        <Link href="/dashboard" className="btn btn-primary btn-sm mt-4">Back home</Link>
      </div>
    </main>
  );
}
