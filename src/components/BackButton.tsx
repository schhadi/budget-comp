"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

/** Goes back in history when there is somewhere to go, otherwise to `fallback`. */
export function BackButton({ fallback, icon = "arrow_back", label = "Back" }: { fallback: string; icon?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      className="icon-btn"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <Icon name={icon} size={24} />
    </button>
  );
}
