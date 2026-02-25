-- Migration 010: Change users.avatar from VARCHAR(500) to TEXT for base64 storage
ALTER TABLE users ALTER COLUMN avatar TYPE TEXT;
