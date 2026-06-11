-- Migration: add 'wc26' to sync_logs.sync_type CHECK constraint
-- Run in Supabase SQL Editor if schema.sql was already applied to the database.
-- Idempotent: safe to run multiple times.

ALTER TABLE sync_logs DROP CONSTRAINT IF EXISTS sync_logs_sync_type_check;
ALTER TABLE sync_logs ADD CONSTRAINT sync_logs_sync_type_check
  CHECK (sync_type IN ('matches','results','standings','points','wc26'));
