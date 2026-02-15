import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  githubId: integer('github_id').unique().notNull(),
  login: text('login').notNull(),
  avatarUrl: text('avatar_url'),
  accessToken: text('access_token'), // 暗号化されたトークン
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  githubRepoId: integer('github_repo_id'),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export const issues = sqliteTable('issues', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  githubIssueNumber: integer('github_issue_number').notNull(),
  title: text('title').notNull(),
  state: text('state').default('open'),
  priority: text('priority'),
  dueDate: text('due_date'),
  startedAt: text('started_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  issueId: text('issue_id').references(() => issues.id),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(), // 'text', 'checklist', 'acceptance'
  title: text('title').notNull(),
  content: text('content'),
  color: text('color').default('#fff9c4'),
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  sortOrder: integer('sort_order'),
  category: text('category'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
