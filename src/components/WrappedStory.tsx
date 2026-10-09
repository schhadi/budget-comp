"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Slide } from "@/lib/anthropic";
import { formatMoney } from "@/lib/money";
import { Icon } from "./Icon";

export interface StoryLeaderRow {
  userId: string;
  name: string;
  rank: number;
  totalMinor: number;
}

interface Props {
  leagueId: string;
  leagueName: string;
  periodLabel: string;
  kind: "weekly" | "monthly";
  currency: string;
  leagueSlides: Slide[];
  mySlides: Slide[];
  leaderboard: StoryLeaderRow[];
  viewerName: string;
}

// Slides are written with an emoji; show a matching line icon instead.
const EMOJI_ICONS: [string[], string][] = [
  [["🏆", "🥇", "👑", "🎉"], "emoji_events"],
  [["💷", "💰", "💸", "💵", "🤑", "🧾"], "payments"],
  [["📊", "📈", "📉"], "bar_chart"],
  [["🫣", "😱", "😬", "🙈", "🚩"], "flag"],
  [["☕", "🥐", "🍩", "🧋"], "local_cafe"],
  [["🍔", "🍕", "🌯", "🍜", "🥡", "🍟"], "restaurant"],
  [["🛒", "🥦", "🥗"], "shopping_cart"],
  [["🍻", "🍺", "🍷", "🍸", "🥂"], "sports_bar"],
  [["🚌", "🚇", "🚕", "🚗", "🚲", "✈️"], "directions_bus"],
  [["🛍️", "👟", "👗", "📦"], "shopping_bag"],
  [["📺", "🎧", "🎮"], "subscriptions"],
  [["📚", "🎓", "✏️"], "menu_book"],
  [["💊", "🏋️", "🧘"], "self_improvement"],
  [["🔥", "⚡"], "local_fire_department"],
  [["📸", "📷", "📅"], "event_available"],
  [["🏪", "🏬"], "storefront"],
  [["👥", "🫂", "👯"], "groups"],
];

function iconFor(emoji: string, fallback: string) {
  const e = emoji.trim();
  return EMOJI_ICONS.find(([list]) => list.some((x) => e.startsWith(x)))?.[1] ?? fallback;
}

type StorySlide =
  | { type: "slide"; slide: Slide; section: "league" | "me" }
  | { type: "intro"; section: "league" | "me" }
  | { type: "board" };

export function WrappedStory(props: Props) {
  const slides: StorySlide[] = [
    { type: "intro", section: "league" },
    ...props.leagueSlides.map((slide) => ({ type: "slide" as const, slide, section: "league" as const })),
    ...(props.mySlides.length ? [{ type: "intro" as const, section: "me" as const }] : []),
    ...props.mySlides.map((slide) => ({ type: "slide" as const, slide, section: "me" as const })),
    { type: "board" },
  ];
  const [index, setIndex] = useState(0);
  const total = slides.length;

  const next = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const current = slides[index];
  const kindLabel = props.kind === "weekly" ? "Weekly" : "Monthly";

  let content: { icon: string; title: string; headline: string; body?: string } | null = null;
  if (current.type === "intro" && current.section === "league") {
    content = { icon: "auto_awesome", title: props.periodLabel, headline: `Your ${props.kind} Wrapped`, body: "Tap to see who spent the least." };
  } else if (current.type === "intro") {
    content = { icon: "person", title: "Now, about you", headline: `${props.viewerName}, your ${props.kind === "weekly" ? "week" : "month"}` };
  } else if (current.type === "slide") {
    const s = current.slide;
    content = { icon: iconFor(s.emoji, current.section === "me" ? "person" : "groups"), title: s.title, headline: s.headline, body: s.body };
  }

  return (
    <div className="fixed inset-0 z-50 bg-story text-story-ink select-none">
      <div className="relative mx-auto flex h-full max-w-[480px] flex-col overflow-hidden">
        <div className="absolute right-3 left-3 z-[3] flex gap-1" style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}>
          {slides.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-sm bg-white/25">
              <div className="h-full bg-story-ink" style={{ width: i <= index ? "100%" : "0%", transition: "width .3s" }} />
            </div>
          ))}
        </div>
        <div
          className="absolute right-2 left-4 z-[3] flex items-center justify-between text-xs font-semibold tracking-[0.04em] text-story-muted"
          style={{ top: "calc(env(safe-area-inset-top) + 24px)" }}
        >
          <span className="truncate">
            {props.leagueName} · {kindLabel} Wrapped
          </span>
          <Link href={`/leagues/${props.leagueId}/wrapped`} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center text-story-ink">
            <Icon name="close" size={24} />
          </Link>
        </div>

        <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 z-[1] w-1/3" onClick={prev} />
        <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 z-[1] w-2/3" onClick={next} />

        <div key={index} className="rise pointer-events-none relative z-[2] flex flex-1 flex-col justify-center px-7">
          {content && (
            <>
              <span className="icon mb-7 text-story-muted" style={{ fontSize: 40, fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }} aria-hidden>
                {content.icon}
              </span>
              <div className="mb-3 text-xs font-semibold tracking-[0.12em] text-story-muted uppercase">{content.title}</div>
              <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] text-pretty">{content.headline}</h1>
              {content.body && <p className="mt-4 max-w-[300px] text-[17px] leading-[1.45] text-pretty text-story-muted">{content.body}</p>}
            </>
          )}
          {current.type === "board" && (
            <>
              <div className="mb-3 text-xs font-semibold tracking-[0.12em] text-story-muted uppercase">Final standings</div>
              <h2 className="mb-[22px] text-[30px] leading-[1.1] font-semibold tracking-[-0.02em]">{props.periodLabel}</h2>
              {props.leaderboard.map((row) => (
                <div key={row.userId} className="flex items-center gap-3 border-t border-white/[.14] py-2.5">
                  <span className="w-[22px] font-mono text-xl text-story-muted">{row.rank}</span>
                  <span className="flex-1 truncate text-base font-semibold">{row.name}</span>
                  <span className="font-mono text-base">{formatMoney(row.totalMinor, props.currency)}</span>
                </div>
              ))}
              <Link
                href={`/leagues/${props.leagueId}`}
                className="pointer-events-auto mt-6 flex h-[50px] w-full items-center justify-center rounded-xl bg-story-ink text-[15px] font-semibold text-story"
              >
                Back to the league
              </Link>
            </>
          )}
        </div>

        <div className="absolute inset-x-0 z-[2] text-center font-mono text-[11px] text-story-muted" style={{ bottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
          {index + 1} / {total}
        </div>
      </div>
    </div>
  );
}
