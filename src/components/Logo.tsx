/**
 * Skint brand marks as inline SVG. The geometry is baked by brand/generate.py (font outlines
 * included), so edit it there and re-run rather than hand-tuning numbers here.
 */

const BRASS = "#e0ad3a";
const COBALT = "#2451b3";
const PAPER = "#f5f3ee";

// The mark: a pill ring with the last penny resting at the bottom. Tight box is 32 x 46.
const MARK_D =
  "M32.0 9 H32.0 A16.0 16.0 0 0 1 48 25.0 V39.0 A16.0 16.0 0 0 1 32.0 55 H32.0 A16.0 16.0 0 0 1 16 39.0 V25.0 A16.0 16.0 0 0 1 32.0 9 Z M32.0 16 H32.0 A9.0 9.0 0 0 1 41 25.0 V39.0 A9.0 9.0 0 0 1 32.0 48 H32.0 A9.0 9.0 0 0 1 23 39.0 V25.0 A9.0 9.0 0 0 1 32.0 16 Z";
const MARK_COIN = { cx: 32.0, cy: 40.5, r: 5 };

// The wordmark: "skint" in Instrument Sans SemiBold, outlined, with the dot of the i swapped for the penny.
const WORD_D =
  "M26.2 1Q15.6 1 9.3 -3.45Q3 -7.9 2.4 -15.8H13.9Q14.4 -11.9 17.6 -9.9Q20.8 -7.9 26.2 -7.9Q31.1 -7.9 33.55 -9.45Q36 -11 36 -13.9Q36 -16 34.6 -17.35Q33.2 -18.7 29.3 -19.6L21.1 -21.5Q12.7 -23.3 8.65 -27.15Q4.6 -31 4.6 -36.8Q4.6 -43.9 10.05 -47.95Q15.5 -52 25.1 -52Q34.6 -52 40.35 -47.95Q46.1 -43.9 46.7 -36.8H35.2Q34.7 -39.9 32.05 -41.5Q29.4 -43.1 24.8 -43.1Q20.5 -43.1 18.3 -41.75Q16.1 -40.4 16.1 -37.8Q16.1 -35.8 17.8 -34.45Q19.5 -33.1 23.5 -32.1L32.3 -30.1Q39.8 -28.4 43.65 -24.2Q47.5 -20 47.5 -14.3Q47.5 -7 41.9 -3Q36.3 1 26.2 1Z M54.3 0V-72.7H66.9V0ZM87.2 0 64 -26.5 86.5 -51H101.7L75.7 -24.2L76.4 -28.9L102.7 0Z M107.3 0V-51H119.9V0Z M131.5 0V-51H143.8V-39H144.1V0ZM167.3 0V-32.2Q167.3 -36.9 164.9 -39.3Q162.5 -41.7 157.9 -41.7Q153.9 -41.7 150.75 -39.9Q147.6 -38.1 145.85 -34.9Q144.1 -31.7 144.1 -27.5L142.8 -39.7Q145.4 -45.3 150.4 -48.65Q155.4 -52 162.4 -52Q170.7 -52 175.35 -47.3Q180 -42.6 180 -34.8V0Z M211.9 1Q202.5 1 198.05 -3.45Q193.6 -7.9 193.6 -16.8V-62.6L206.3 -67.3V-16.5Q206.3 -12.8 208.3 -11Q210.3 -9.2 214.6 -9.2Q216.3 -9.2 217.65 -9.45Q219 -9.7 220.2 -10.1V-0.3Q219 0.3 216.8 0.65Q214.6 1 211.9 1ZM183.8 -41.1V-51H220.2V-41.1Z";
const WORD_COIN = { cx: 113.55, cy: -67.35, r: 7.95 };
const WORD_VB = "0.4 -77.29 221.8 80.29";
const WORD_RATIO = 221.8 / 80.29;

// Lockup: app tile beside the wordmark, both on the wordmark's coordinate system (baseline at y=0).
const TILE = 82.0;
const TILE_Y = -77.35;
const WORD_DX = 99.6;
const LOCKUP_VB = "-2 -79.35 323.8 86.0";
const LOCKUP_RATIO = 323.8 / 86.0;

function MarkShape({ ring, coin }: { ring: string; coin: string }) {
  return (
    <>
      <path fillRule="evenodd" fill={ring} d={MARK_D} />
      <circle cx={MARK_COIN.cx} cy={MARK_COIN.cy} r={MARK_COIN.r} fill={coin} />
    </>
  );
}

/** Cobalt rounded square with the mark centred in it, the same drawing as the app icon. */
function TileShape({ size, x = 0, y = 0 }: { size: number; x?: number; y?: number }) {
  const sc = (size * 0.63) / 46;
  const off = size / 2 - 32 * sc;
  return (
    <>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.2237} fill={COBALT} />
      <g transform={`translate(${x + off} ${y + off}) scale(${sc})`}>
        <MarkShape ring={PAPER} coin={BRASS} />
      </g>
    </>
  );
}

/** The ring-and-penny mark on its own. Ring takes the text colour; the penny stays brass. */
export function Mark({ height = 24, className = "" }: { height?: number; className?: string }) {
  return (
    <svg width={(height * 32) / 46} height={height} viewBox="16 9 32 46" role="img" aria-label="Skint" className={className}>
      <MarkShape ring="currentColor" coin={BRASS} />
    </svg>
  );
}

/** The app icon as an inline tile. */
export function Tile({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Skint" className={className}>
      <TileShape size={size} />
    </svg>
  );
}

/** "skint" in the text colour, with the brass penny over the i. */
export function Wordmark({ height = 24, className = "" }: { height?: number; className?: string }) {
  return (
    <svg width={height * WORD_RATIO} height={height} viewBox={WORD_VB} role="img" aria-label="Skint" className={className}>
      <path fill="currentColor" d={WORD_D} />
      <circle cx={WORD_COIN.cx} cy={WORD_COIN.cy} r={WORD_COIN.r} fill={BRASS} />
    </svg>
  );
}

/** Tile plus wordmark. Use this wherever the product introduces itself. */
export function Lockup({ height = 28, className = "" }: { height?: number; className?: string }) {
  return (
    <svg width={height * LOCKUP_RATIO} height={height} viewBox={LOCKUP_VB} role="img" aria-label="Skint" className={className}>
      <TileShape size={TILE} y={TILE_Y} />
      <g transform={`translate(${WORD_DX} 0)`}>
        <path fill="currentColor" d={WORD_D} />
        <circle cx={WORD_COIN.cx} cy={WORD_COIN.cy} r={WORD_COIN.r} fill={BRASS} />
      </g>
    </svg>
  );
}
