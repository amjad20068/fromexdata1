-- Migration 003: Data Backups Table for Snapshots and Instant Undo
CREATE TABLE IF NOT EXISTS data_backups (
  id SERIAL PRIMARY KEY,
  backup_type VARCHAR(50) NOT NULL DEFAULT 'manual_clear',
  description TEXT,
  cleared_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  records_count INTEGER NOT NULL DEFAULT 0,
  snapshot_data TEXT NOT NULL, -- JSON string representation of backed-up records
  is_restored BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  restored_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_data_backups_created ON data_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_backups_restored ON data_backups(is_restored);
