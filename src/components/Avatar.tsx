/* eslint-disable @next/next/no-img-element */
export function Avatar({ name, image, size = 36 }: { name: string | null; image?: string | null; size?: number }) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  if (image) {
    return (
      <img
        src={image}
        alt={name ?? ""}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-accent/30 text-foreground font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}
