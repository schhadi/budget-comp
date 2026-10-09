import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORY_IDS } from "./categories";
import { PARSER_MODEL, RECAP_MODEL } from "./env";

const client = new Anthropic();

/** Server-side refusal fallbacks are supported on the Opus 5 / Sonnet 5.5 / Fable families, not on Haiku. */
function fallbackParams(model: string) {
  const supports = /^claude-(opus-5|sonnet-5-5|fable-5)/.test(model);
  return supports
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

// ---------------- Screenshot parsing ----------------

export const ParsedTransactionSchema = z.object({
  amount: z.number().describe("Amount spent as a positive decimal number, e.g. 4.5"),
  currency: z.string().describe("ISO 4217 code, e.g. GBP, EUR, USD"),
  merchant: z.string().describe("Short merchant or payee name, e.g. 'Tesco Express'"),
  category: z.enum(CATEGORY_IDS),
  date: z.string().nullable().describe("YYYY-MM-DD if visible, otherwise null"),
  confidence: z.number().describe("0 to 1, how sure you are about amount + merchant"),
  notes: z.string().nullable().describe("Anything the user should double check"),
});

export const ParsedScreenshotSchema = z.object({
  screenshot_type: z.enum(["bank_app", "receipt", "order_confirmation", "payment_app", "other"]),
  is_spending: z.boolean().describe("false if the image shows no outgoing spending at all"),
  transactions: z.array(ParsedTransactionSchema),
  warnings: z.array(z.string()),
});

export type ParsedScreenshot = z.infer<typeof ParsedScreenshotSchema>;

const PARSE_SYSTEM = `You read screenshots that university students upload to log their spending for a friendly "who can spend the least" competition.

Extract every OUTGOING payment visible in the image (card payments, transfers out, orders, receipts).
- Ignore incoming money, refunds, balances, pending authorisations that were later reversed, and pure account balances.
- A bank app list can contain many transactions: return each one separately, newest first.
- A receipt or order confirmation is ONE transaction for the total paid (not each line item).
- amount is always positive. Use the currency shown; if only a symbol is shown, infer the most likely code (£ = GBP, € = EUR, $ = USD unless context says otherwise).
- date: only if the actual date is visible or can be inferred from "Today"/"Yesterday" using the reference date given. Otherwise null.
- category: pick the closest from the allowed list. Supermarkets are groceries; cafes, Pret, Greggs, vending are coffee; restaurants, Deliveroo, Uber Eats, takeaways are food_out; pubs, bars, clubs are drinks_nights_out; TfL, trains, buses, Uber rides are transport; Netflix, Spotify, gym memberships are subscriptions; rent, council tax, energy, phone bill are rent_bills.
- confidence below 0.6 if the amount or merchant is cut off, blurry, or ambiguous.
- If nothing in the image is spending, set is_spending=false and return an empty list.`;

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export async function parseScreenshotImage(input: {
  data: ArrayBuffer;
  mediaType: string;
  referenceDate: string;
  leagueCurrency: string;
}): Promise<ParsedScreenshot> {
  const mediaType = normaliseMediaType(input.mediaType);
  const base64 = Buffer.from(input.data).toString("base64");

  const response = await client.beta.messages.parse({
    model: PARSER_MODEL,
    max_tokens: 4000,
    ...fallbackParams(PARSER_MODEL),
    system: PARSE_SYSTEM,
    output_config: {
      effort: "low",
      format: zodOutputFormat(ParsedScreenshotSchema),
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: `Reference date (today for the uploader): ${input.referenceDate}. The league's currency is ${input.leagueCurrency}. Extract the spending in this screenshot.`,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The AI declined to read this image. Try a clearer screenshot or enter the amount manually.");
  }
  if (!response.parsed_output) {
    throw new Error("Could not read a structured result from the AI. Try again or enter it manually.");
  }
  return response.parsed_output;
}

function normaliseMediaType(ct: string): ImageMediaType {
  const lower = ct.toLowerCase();
  if (lower.includes("png")) return "image/png";
  if (lower.includes("webp")) return "image/webp";
  if (lower.includes("gif")) return "image/gif";
  return "image/jpeg";
}

// ---------------- Wrapped-style recap ----------------

export const SlideSchema = z.object({
  title: z.string().describe("Tiny label at the top, e.g. 'Your top category'"),
  headline: z.string().describe("The big text, max ~8 words"),
  body: z.string().describe("One or two short cheeky sentences"),
  emoji: z.string().describe("One emoji that fits the slide"),
});

export const RecapSlidesSchema = z.object({
  league_slides: z.array(SlideSchema).describe("5 to 7 slides about the whole league, ending with the winner reveal"),
  member_slides: z.array(
    z.object({
      user_id: z.string(),
      slides: z.array(SlideSchema).describe("3 to 5 personal slides for this member"),
    }),
  ),
});

export type RecapSlides = z.infer<typeof RecapSlidesSchema>;
export type Slide = z.infer<typeof SlideSchema>;

const RECAP_SYSTEM = `You write a Spotify-Wrapped-style recap for a group of university friends competing to spend the LEAST money. Lowest total wins.

Tone: playful, a bit cheeky, affectionate roast energy, never cruel. British English. Short punchy lines that look good on a phone screen one slide at a time. Use the exact formatted amounts you are given (do not recompute or round them). Refer to people by their first name.

Rules:
- league_slides: open with a hook, cover the group's total, the most popular category or merchant, the biggest single purchase (name who), the most consistent logger or best no-spend streak, then a dramatic winner reveal as the LAST slide. If someone had missed days / penalties, you may tease them.
- member_slides: one entry for EVERY member id provided, 3 to 5 slides each: their total and rank, their top category and top merchant, their biggest purchase, a no-spend-days or streak slide, and a closing one-liner. If a member has no spending at all, celebrate or gently suspect them.
- Never invent numbers. Only use numbers from the stats JSON.`;

export async function generateRecapSlides(stats: unknown): Promise<RecapSlides> {
  const response = await client.beta.messages.parse({
    model: RECAP_MODEL,
    max_tokens: 16000,
    ...fallbackParams(RECAP_MODEL),
    system: RECAP_SYSTEM,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(RecapSlidesSchema),
    },
    messages: [
      {
        role: "user",
        content: `Here are the stats for this period as JSON. Write the recap.\n\n${JSON.stringify(stats, null, 2)}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Could not generate the recap right now.");
  }
  return response.parsed_output;
}

// ---------------- Merchant categorisation (Apple Pay shortcut) ----------------

export const MerchantGuessSchema = z.object({
  merchant: z.string().describe("Short, human-friendly merchant name, e.g. 'Tesco Express' from 'TESCO STORES 3245'"),
  category: z.enum(CATEGORY_IDS),
  confidence: z.number().describe("0 to 1, how sure you are about the category"),
});

export type MerchantGuess = z.infer<typeof MerchantGuessSchema>;

const CATEGORISE_SYSTEM = `You tidy up card-payment merchant names and pick a spending category for a UK university student's spending tracker.

- merchant: strip store numbers, card-processor prefixes (SUMUP *, SQ *, PAYPAL *), city codes and ALL CAPS. Keep the brand recognisable.
- category: pick the closest from the allowed list. Supermarkets are groceries; cafes, Pret, Greggs, vending are coffee; restaurants, Deliveroo, Uber Eats, takeaways are food_out; pubs, bars, clubs are drinks_nights_out; TfL, trains, buses, Uber rides are transport; Netflix, Spotify, gym memberships are subscriptions; rent, council tax, energy, phone bill are rent_bills; pharmacies and gyms are health; bookshops and university fees are books_uni; clothes and general retail are shopping; otherwise other.
- confidence below 0.6 if the name is ambiguous or you are guessing.`;

/** One short call per Apple Pay tap whose merchant the keyword rules didn't recognise. */
export async function categoriseMerchant(input: { merchant: string; card?: string | null }): Promise<MerchantGuess> {
  const response = await client.beta.messages.parse({
    model: PARSER_MODEL,
    max_tokens: 2000,
    ...fallbackParams(PARSER_MODEL),
    system: CATEGORISE_SYSTEM,
    output_config: {
      effort: "low",
      format: zodOutputFormat(MerchantGuessSchema),
    },
    messages: [
      {
        role: "user",
        content: `Merchant as reported by Apple Pay: ${JSON.stringify(input.merchant)}${input.card ? `\nCard used: ${JSON.stringify(input.card)}` : ""}`,
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Could not categorise this merchant.");
  }
  return response.parsed_output;
}
