import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  bigserial,
  inet,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Tenants (Laboratorios)
export const masterTenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  database_name: varchar('database_name', { length: 63 }).notNull().unique(),
  db_cluster: varchar('db_cluster', { length: 50 }).notNull().default('default'),
  status: varchar('status', { length: 30 }).notNull().default('ACTIVE'),
  provisioning_step: varchar('provisioning_step', { length: 50 }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// 2. Identities (Usuarios Globales)
export const masterIdentities = pgTable('identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  email_verified_at: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
  password_hash: text('password_hash'),
  password_changed_at: timestamp('password_changed_at', { withTimezone: true, mode: 'date' }),
  must_change_password: boolean('must_change_password').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  mfa_enabled: boolean('mfa_enabled').notNull().default(false),
  mfa_secret_enc: text('mfa_secret_enc'),
  mfa_enrolled_at: timestamp('mfa_enrolled_at', { withTimezone: true, mode: 'date' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// 3. MFA Backup Codes
export const masterMfaBackupCodes = pgTable('mfa_backup_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  identity_id: uuid('identity_id').notNull().references(() => masterIdentities.id, { onDelete: 'cascade' }),
  code_hash: text('code_hash').notNull(),
  used_at: timestamp('used_at', { withTimezone: true, mode: 'date' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('idx_mfa_backup_codes_identity').on(table.identity_id),
]);

// 4. Memberships (Relación Identidad <-> Tenant)
export const masterMemberships = pgTable('memberships', {
  identity_id: uuid('identity_id').notNull().references(() => masterIdentities.id, { onDelete: 'restrict' }),
  tenant_id: uuid('tenant_id').notNull().references(() => masterTenants.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  invited_by: uuid('invited_by').references(() => masterIdentities.id),
  accepted_at: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.identity_id, table.tenant_id] }),
  index('idx_memberships_tenant').on(table.tenant_id),
]);

// 5. Sessions (Sesiones y Tokens)
export const masterSessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  identity_id: uuid('identity_id').notNull().references(() => masterIdentities.id),
  tenant_id: uuid('tenant_id').references(() => masterTenants.id),
  refresh_token_hash: text('refresh_token_hash').notNull().unique(),
  previous_refresh_token_hash: text('previous_refresh_token_hash'),
  mfa_verified_at: timestamp('mfa_verified_at', { withTimezone: true, mode: 'date' }),
  ip: inet('ip'),
  user_agent: text('user_agent'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  last_used_at: timestamp('last_used_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  revoked_at: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  revoked_reason: varchar('revoked_reason', { length: 50 }),
}, (table) => [
  index('idx_sessions_identity_active').on(table.identity_id),
]);

// 6. Identity Tokens (Invitaciones y recuperación)
export const masterIdentityTokens = pgTable('identity_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  identity_id: uuid('identity_id').notNull().references(() => masterIdentities.id),
  tenant_id: uuid('tenant_id').references(() => masterTenants.id),
  purpose: varchar('purpose', { length: 30 }).notNull(),
  token_hash: text('token_hash').notNull().unique(),
  payload: jsonb('payload'),
  expires_at: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  used_at: timestamp('used_at', { withTimezone: true, mode: 'date' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// 7. Platform Admins
export const masterPlatformAdmins = pgTable('platform_admins', {
  identity_id: uuid('identity_id').primaryKey().references(() => masterIdentities.id),
  role: varchar('role', { length: 30 }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// 8. Auth Events (Auditoría)
export const masterAuthEvents = pgTable('auth_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  identity_id: uuid('identity_id'),
  tenant_id: uuid('tenant_id'),
  event: varchar('event', { length: 50 }).notNull(),
  ip: inet('ip'),
  user_agent: text('user_agent'),
  detail: jsonb('detail'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('idx_auth_events_identity').on(table.identity_id, table.created_at),
]);

// 9. Public Links (Enlaces opacos sin sesión para resultados y verificación de reportes)
export const masterPublicLinks = pgTable('public_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  token_hash: text('token_hash').notNull().unique(),
  tenant_id: uuid('tenant_id').notNull().references(() => masterTenants.id),
  purpose: varchar('purpose', { length: 30 }).notNull(),
  resource_type: varchar('resource_type', { length: 50 }).notNull(),
  resource_id: varchar('resource_id', { length: 100 }).notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  revoked_at: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// 10. External Bindings (Webhooks vinculados a tenants)
export const masterExternalBindings = pgTable('external_bindings', {
  provider: varchar('provider', { length: 50 }).notNull(),
  external_account_id: varchar('external_account_id', { length: 200 }).notNull(),
  tenant_id: uuid('tenant_id').notNull().references(() => masterTenants.id),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.provider, table.external_account_id] }),
]);

