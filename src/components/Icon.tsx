/** Material Symbols Rounded glyph. `name` is the ligature, e.g. "photo_camera". */
export function Icon({ name, size = 22, fill = false, className = "" }: { name: string; size?: number; fill?: boolean; className?: string }) {
  return (
    <span className={`icon ${fill ? "icon-fill" : ""} ${className}`} style={{ fontSize: size }} aria-hidden>
      {name}
    </span>
  );
}
