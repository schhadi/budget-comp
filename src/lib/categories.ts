export const CATEGORIES = [
  { id: "groceries", label: "Groceries", short: "Groceries", emoji: "🛒", icon: "shopping_cart" },
  { id: "food_out", label: "Eating out & takeaway", short: "Eating out", emoji: "🍔", icon: "restaurant" },
  { id: "coffee", label: "Coffee & snacks", short: "Coffee", emoji: "☕", icon: "local_cafe" },
  { id: "drinks_nights_out", label: "Drinks & nights out", short: "Drinks", emoji: "🍻", icon: "sports_bar" },
  { id: "transport", label: "Transport", short: "Transport", emoji: "🚌", icon: "directions_bus" },
  { id: "rent_bills", label: "Rent & bills", short: "Rent & bills", emoji: "🏠", icon: "home" },
  { id: "subscriptions", label: "Subscriptions", short: "Subscriptions", emoji: "📺", icon: "subscriptions" },
  { id: "shopping", label: "Shopping & clothes", short: "Shopping", emoji: "🛍️", icon: "shopping_bag" },
  { id: "books_uni", label: "Books & uni", short: "Books & uni", emoji: "📚", icon: "menu_book" },
  { id: "health", label: "Health & fitness", short: "Health", emoji: "💊", icon: "fitness_center" },
  { id: "other", label: "Other", short: "Other", emoji: "📦", icon: "inventory_2" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function categoryInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function isCategory(id: string): id is CategoryId {
  return CATEGORY_IDS.includes(id as CategoryId);
}
