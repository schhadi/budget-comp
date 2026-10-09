import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------- Auth.js tables ----------

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  reminderEmails: boolean("reminder_emails").notNull().default(true),
  recapEmails: boolean("recap_emails").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------- App tables ----------

export const friendships = pgTable(
  "friendship",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<"pending" | "accepted">().notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("friendship_pair_idx").on(t.requesterId, t.addresseeId),
    index("friendship_addressee_idx").on(t.addresseeId),
  ],
);

export type LeagueWindow = "weekly" | "monthly";

export const leagues = pgTable("league", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🏆"),
  inviteCode: text("invite_code").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  currency: text("currency").notNull().default("GBP"),
  timezone: text("timezone").notNull().default("Europe/London"),
  window: text("window").$type<LeagueWindow>().notNull().default("weekly"),
  excludedCategories: jsonb("excluded_categories").$type<string[]>().notNull().default([]),
  dailyUploadRequired: boolean("daily_upload_required").notNull().default(true),
  missedDayPenaltyMinor: integer("missed_day_penalty_minor").notNull().default(0),
  budgetTargetMinor: integer("budget_target_minor"),
  stake: text("stake"),
  allowChallenges: boolean("allow_challenges").notNull().default(true),
  weeklyRecap: boolean("weekly_recap").notNull().default(true),
  monthlyRecap: boolean("monthly_recap").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "membership",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "member">().notNull().default("member"),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("membership_unique_idx").on(t.leagueId, t.userId),
    index("membership_user_idx").on(t.userId),
  ],
);

export const screenshots = pgTable(
  "screenshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    contentType: text("content_type").notNull().default("image/jpeg"),
    status: text("status").$type<"pending" | "parsed" | "failed">().notNull().default("pending"),
    screenshotType: text("screenshot_type"),
    rawJson: jsonb("raw_json"),
    error: text("error"),
    uploadedAt: timestamp("uploaded_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("screenshot_league_user_idx").on(t.leagueId, t.userId)],
);

export type TransactionStatus = "pending" | "confirmed" | "rejected";

export const transactions = pgTable(
  "transaction",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    screenshotId: text("screenshot_id").references(() => screenshots.id, {
      onDelete: "set null",
    }),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    amountLeagueMinor: integer("amount_league_minor").notNull(),
    merchant: text("merchant").notNull(),
    category: text("category").notNull(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    status: text("status").$type<TransactionStatus>().notNull().default("pending"),
    confidence: real("confidence"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { mode: "date" }),
  },
  (t) => [
    index("transaction_league_user_idx").on(t.leagueId, t.userId, t.occurredOn),
    index("transaction_league_status_idx").on(t.leagueId, t.status),
  ],
);

export const dayLogs = pgTable(
  "day_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    kind: text("kind").$type<"spend" | "no_spend">().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("day_log_unique_idx").on(t.leagueId, t.userId, t.day)],
);

export const challenges = pgTable(
  "challenge",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    raisedById: text("raised_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    resolution: text("resolution").$type<"open" | "upheld" | "dismissed">().notNull().default("open"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("challenge_tx_idx").on(t.transactionId)],
);

export type RecapKind = "weekly" | "monthly";

export const recaps = pgTable(
  "recap",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RecapKind>().notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    stats: jsonb("stats").notNull(),
    slides: jsonb("slides").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("recap_unique_idx").on(t.leagueId, t.kind, t.periodStart)],
);

export const badges = pgTable(
  "badge",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    label: text("label").notNull(),
    emoji: text("emoji").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("badge_unique_idx").on(t.leagueId, t.userId, t.type, t.periodStart),
    index("badge_user_idx").on(t.userId),
  ],
);

export type User = typeof users.$inferSelect;
export type League = typeof leagues.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Screenshot = typeof screenshots.$inferSelect;
export type Recap = typeof recaps.$inferSelect;
export type Badge = typeof badges.$inferSelect;
