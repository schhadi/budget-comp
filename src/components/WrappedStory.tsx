"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Slide } from "@/lib/anthropic";
import { formatMoney } from "@/lib/money";
import { Avatar } from "./Avatar";

export interface StoryLeaderRow {
  userId: string;
  name: string;
  image: string | null;
  rank: number;
  totalMinor: number;
}

interface Props {
  leagueId: string;
  leagueName: string;
  emoji: string;
  periodLabel: string;
  kind: "weekly" | "monthly";
  currency: string;
  leagueSlides: Slide[];
  mySlides: Slide[];
  leaderboard: StoryLeaderRow[];
  viewerName: string;
}

const GRADIENTS = [
  "from-fuchsia-600 via-purple-700 to-indigo-900",
  "from-cyan-500 via-sky-600 to-blue-900",
  "from-amber-400 via-orange-600 to-rose-800",
  "from-emerald-400 via-teal-600 to-cyan-900",
  "from-pink-500 via-rose-600 to-red-900",
  "from-violet-500 via-indigo-600 to-slate-900",
  "from-lime-400 via-green-600 to-emerald-900",
];

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
  const gradient = GRADIENTS[index % GRADIENTS.length];

  return (
    <div className={`fixed inset-0 z-50 bg-gradient-to-br ${gradient} text-white select-none`}>
      {/* progress */}
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
        {slides.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
            <div className={`h-full bg-white ${i < index ? "w-full" : i === index ? "w-full" : "w-0"}`} style={{ transition: "width .3s" }} />
          </div>
        ))}
      </div>
      <div className="absolute top-6 left-4 right-4 flex items-center justify-between text-xs font-medium z-10 opacity-90">
        <span>{props.emoji} {props.leagueName} · {props.kind} Wrapped</span>
        <Link href={`/leagues/${props.leagueId}/wrapped`} className="bg-black/30 rounded-full px-3 py-1">Close ✕</Link>
      </div>

      {/* tap zones */}
      <button aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3 z-0" onClick={prev} />
      <button aria-label="Next" className="absolute inset-y-0 right-0 w-2/3 z-0" onClick={next} />

      <div key={index} className="relative h-full flex flex-col items-center justify-center px-8 text-center slide-in pointer-events-none">
        {current.type === "intro" && current.section === "league" && (
          <>
            <div className="text-6xl mb-6">{props.emoji}</div>
            <div className="uppercase tracking-[0.3em] text-xs opacity-80 mb-3">{props.periodLabel}</div>
            <h1 className="text-4xl font-black leading-tight">Your {props.kind} Wrapped</h1>
            <p className="mt-4 opacity-80">Tap to see who spent the least.</p>
          </>
        )}
        {current.type === "intro" && current.section === "me" && (
          <>
            <div className="text-6xl mb-6">🫵</div>
            <h1 className="text-4xl font-black leading-tight">Now, about you, {props.viewerName}…</h1>
          </>
        )}
        {current.type === "slide" && (
          <>
            <div className="text-6xl mb-6">{current.slide.emoji}</div>
            <div className="uppercase tracking-[0.3em] text-xs opacity-80 mb-3">{current.slide.title}</div>
            <h2 className="text-3xl sm:text-4xl font-black leading-tight">{current.slide.headline}</h2>
            <p className="mt-4 text-base sm:text-lg opacity-90 max-w-md">{current.slide.body}</p>
          </>
        )}
        {current.type === "board" && (
          <div className="w-full max-w-sm pointer-events-auto">
            <div className="uppercase tracking-[0.3em] text-xs opacity-80 mb-3">Final standings</div>
            <h2 className="text-3xl font-black mb-5">{props.periodLabel}</h2>
            <ol className="space-y-2 text-left">
              {props.leaderboard.map((row) => (
                <li key={row.userId} className="flex items-center gap-3 bg-black/25 rounded-2xl px-3 py-2">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${row.rank <= 3 ? `rank-${row.rank}` : "bg-white/20"}`}>{row.rank}</span>
                  <Avatar name={row.name} image={row.image} size={30} />
                  <span className="flex-1 truncate font-medium">{row.name}</span>
                  <span className="font-mono text-sm">{formatMoney(row.totalMinor, props.currency)}</span>
                </li>
              ))}
            </ol>
            <Link href={`/leagues/${props.leagueId}`} className="btn mt-6 w-full bg-white text-black">Back to the league</Link>
          </div>
        )}
      </div>

      <div className="absolute bottom-5 inset-x-0 text-center text-xs opacity-60">{index + 1} / {total}</div>
    </div>
  );
}
