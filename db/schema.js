import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

// user_id stores the Clerk user ID (a string like "user_2abc...") —
// every table is scoped by it so this is multi-user from day one.

export const folders = pgTable("folders", {
  id: serial().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  folderId: integer("folder_id").references(() => folders.id, {
    onDelete: "set null",
  }),
  title: varchar({ length: 255 }).notNull().default(""),
  body: text().notNull().default(""),
  isMarkdown: boolean("is_markdown").notNull().default(true),
  lat: doublePrecision(),
  lng: doublePrecision(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: serial().primaryKey(),
  noteId: integer("note_id")
    .references(() => notes.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  blobKey: varchar("blob_key", { length: 500 }).notNull(),
  filename: varchar({ length: 255 }).notNull().default(""),
  contentType: varchar("content_type", { length: 100 }).notNull().default("image/jpeg"),
  createdAt: timestamp("created_at").defaultNow(),
});
