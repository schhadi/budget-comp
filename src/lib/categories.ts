export const CATEGORIES = [
  { id: "groceries", label: "Groceries", emoji: "🛒" },
  { id: "food_out", label: "Eating out & takeaway", emoji: "🍔" },
  { id: "coffee", label: "Coffee & snacks", emoji: "☕" },
  { id: "drinks_nights_out", label: "Drinks & nights out", emoji: "🍻" },
  { id: "transport", label: "Transport", emoji: "🚌" },
  { id: "rent_bills", label: "Rent & bills", emoji: "🏠" },
  { id: "subscriptions", label: "Subscriptions", emoji: "📺" },
  { id: "shopping", label: "Shopping & clothes", emoji: "🛍️" },
  { id: "books_uni", label: "Books & uni", emoji: "📚" },
  { id: "health", label: "Health & fitness", emoji: "💊" },
  { id: "other", label: "Other", emoji: "📦" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function categoryInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function isCategory(id: string): id is CategoryId {
  return CATEGORY_IDS.includes(id as CategoryId);
}
