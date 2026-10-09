import { categoriseMerchant } from "./anthropic";
import type { CategoryId } from "./categories";

/**
 * Category guessing for merchant names that arrive as plain text (the Apple Pay shortcut).
 * A keyword pass handles the well-known UK brands for free; anything else goes to the model.
 */

type Rule = [pattern: RegExp, category: CategoryId, confidence: number];

// Order matters: earlier rules win, so "uber eats" is listed before "uber", "amazon prime" before "amazon".
const RULES: Rule[] = [
  [
    /uber\s*eats|deliveroo|just\s*eat|domino'?s|papa\s*john|pizza|mcdonald|burger king|\bkfc\b|nando|wagamama|five guys|subway|chipotle|\bitsu\b|wasabi|\bleon\b|honest burger|dishoom|franco manca|tortilla|chopstix|wingstop|popeyes|taco bell|dumpling|noodle|kebab|chicken shop|\bcurry\b|tandoori|sushi|ramen|restaurant|\bdiner\b|\bgrill\b|zizzi|ask italian|prezzo|wahaca|bill'?s\b|takeaway|take away/i,
    "food_out",
    0.85,
  ],
  [
    /\bpret\b|greggs|\bcosta\b|starbucks|caff?[eè] nero|\bnero\b|black sheep|blank street|gail'?s|joe\s*&\s*the\s*juice|coffee|\bcaf[eé]\b|bakery|\bboba\b|bubble tea|chaiiwala|tim hortons|\bpaul\b|le pain|krispy kreme|doughnut|donut|ice\s?cream|vending/i,
    "coffee",
    0.8,
  ],
  [
    /tesco|sainsbury|\baldi\b|\blidl\b|\bco-?op\b|waitrose|\basda\b|morrisons|iceland|m\s*&\s*s\b|marks\s*(?:&|and)\s*spencer|\bocado\b|whole\s?foods|\bnisa\b|\bspar\b|londis|budgens|costcutter|premier stores|\bgetir\b|gorillas|\bzapp\b|supermarket|grocer|food\s?store|mini\s?market|convenience|farmfoods|poundland|\bb\s*&\s*m\b/i,
    "groceries",
    0.85,
  ],
  [
    /\btfl\b|transport for london|trainline|national rail|\bgwr\b|\blner\b|avanti|southeastern|southern rail|thameslink|northern rail|crosscountry|scotrail|transpennine|elizabeth line|overground|stagecoach|arriva|first\s?bus|megabus|national express|flixbus|\buber\b|\bbolt\b|\blime\b|\btier\b|\bvoi\b|santander cycles|forest bikes|citymapper|addison lee|free\s?now|\bgett\b|ryanair|easyjet|british airways|\bwizz\b|jet2|eurostar|oyster|parking|petrol|\bshell\b|\bbp\b|\besso\b|texaco/i,
    "transport",
    0.85,
  ],
  [
    /netflix|spotify|apple\.com|apple services|itunes|icloud|youtube|google storage|google one|disney|amazon prime|prime video|now tv|paramount|crunchyroll|audible|kindle unlimited|openai|chatgpt|anthropic|midjourney|notion|adobe|microsoft 365|dropbox|patreon|twitch|playstation|\bxbox\b|nintendo|steam games|discord|duolingo|headspace|strava|github|vodafone|\bo2\b|\bee\b|three\.co|giffgaff|lebara|\blyca\b|smarty|\bvoxi\b|virgin media|\bsky\b|\bbt\b|talktalk|hyperoptic|plusnet/i,
    "subscriptions",
    0.8,
  ],
  [
    /wetherspoon|spoons|brewdog|all bar one|slug and lettuce|be at one|simmons|revolution|\bfabric\b|ministry of sound|printworks|\bxoyo\b|phonox|\bbar\b|\bpub\b|tavern|brewery|taproom|\bclub\b|nightclub|cocktail|\bwine\b|off[- ]licence|bargain booze|majestic|dice\.fm|dice tickets|skiddle|fatsoma|resident advisor/i,
    "drinks_nights_out",
    0.7,
  ],
  [
    /\brent\b|council tax|british gas|octopus energy|ovo energy|\bedf\b|\be\.?on\b|scottish power|thames water|severn trent|anglian water|united utilities|yorkshire water|tv licence|unite students|iq student|student roost|fresh student|chapter living|vita student|unilife|letting|\bestate\b|landlord|\bhalls\b|accommodation/i,
    "rent_bills",
    0.85,
  ],
  [
    /\bboots\b|superdrug|pharmacy|chemist|puregym|pure gym|the gym|\bgym\b|anytime fitness|david lloyd|virgin active|nuffield|better leisure|everyone active|\bnhs\b|dentist|dental|optician|specsavers|vision express|holland\s*&\s*barrett|myprotein|bulk\.com|gymshark/i,
    "health",
    0.75,
  ],
  [
    /waterstones|blackwell|foyles|wh\s?smith|\bryman\b|paperchase|stationery|book\s?shop|bookstore|library|\bsoas\b|\bucl\b|\bkcl\b|\blse\b|university|college|student'?s'? union|campus|printing|print shop|turnitin|chegg|quizlet|grammarly|jstor|pearson|cengage|mcgraw|wiley|university press|routledge|textbook/i,
    "books_uni",
    0.75,
  ],
  [
    /amazon|\bebay\b|\bargos\b|primark|\bzara\b|h\s*&\s*m\b|\bhm\b|uniqlo|\basos\b|\bnext\b|new look|river island|urban outfitters|shein|\btemu\b|vinted|depop|\bnike\b|adidas|foot\s?locker|schuh|office shoes|clarks|tk\s?maxx|john lewis|selfridges|harrods|house of fraser|\bikea\b|dunelm|the range|wilko|flying tiger|currys|apple store|samsung|\bgame\b|\bhmv\b|\bcex\b|\betsy\b|\blush\b|the body shop|sephora|space nk|cult beauty|boohoo|pretty\s?little\s?thing|\bjd\b|sports direct|decathlon|end clothing|\bcos\b|arket|weekday|monki|\bmango\b|bershka|pull\s*&\s*bear|stradivarius|flannels|charity shop|oxfam|british heart|cancer research|barnardo/i,
    "shopping",
    0.75,
  ],
];

export function guessCategoryByKeyword(merchant: string): { category: CategoryId; confidence: number } | null {
  const m = merchant.toLowerCase();
  for (const [pattern, category, confidence] of RULES) {
    if (pattern.test(m)) return { category, confidence };
  }
  return null;
}

/** Card-processor prefixes that Apple Pay surfaces verbatim, e.g. "SUMUP *THE COFFEE CART". */
const PROCESSOR_PREFIX = /^(?:sumup|sq|iz|izettle|zettle|paypal|pp|crv|sp|tst|dnh|pos|card)\s*[*_:-]\s*/i;

/** Light clean-up for the keyword path: strip processor prefixes and SHOUTING. */
export function tidyMerchant(raw: string) {
  let s = raw.replace(/\s+/g, " ").trim().replace(PROCESSOR_PREFIX, "").trim();
  if (s.length > 3 && s === s.toUpperCase() && /[A-Z]/.test(s)) {
    s = s
      .toLowerCase()
      .replace(/(^|[\s'(&/-])([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
  }
  return s.slice(0, 80);
}

export interface MerchantResolution {
  merchant: string;
  category: CategoryId;
  confidence: number;
  /** "keyword" when a rule matched, "ai" when the model was asked, "fallback" when the model call failed. */
  via: "keyword" | "ai" | "fallback" | "blank";
}

/** Turn the raw merchant string from Apple Pay into a tidy name plus a category guess. */
export async function resolveMerchant(raw: string, card?: string | null): Promise<MerchantResolution> {
  const trimmed = raw.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!trimmed) return { merchant: "Apple Pay payment", category: "other", confidence: 0, via: "blank" };

  const byKeyword = guessCategoryByKeyword(trimmed);
  if (byKeyword) return { merchant: tidyMerchant(trimmed), ...byKeyword, via: "keyword" };

  try {
    const ai = await categoriseMerchant({ merchant: trimmed, card });
    const merchant = ai.merchant.trim().slice(0, 80) || tidyMerchant(trimmed);
    return { merchant, category: ai.category, confidence: Math.max(0, Math.min(1, ai.confidence)), via: "ai" };
  } catch (err) {
    console.warn("[apple-pay] merchant categorisation failed", err);
    return { merchant: tidyMerchant(trimmed), category: "other", confidence: 0.3, via: "fallback" };
  }
}
