const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  console.log('🔄 Starting database migration...');
  console.log('📍 Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Check if tables already exist
    const checkResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'workspaces';
    `);

    const tablesExist = parseInt(checkResult.rows[0].count) > 0;

    if (tablesExist) {
      console.log('ℹ️  Database tables already exist, skipping initial schema');
    } else {
      // Read schema file
      const schemaPath = path.join(__dirname, '../database/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');

      console.log('📄 Running schema.sql...');

      // Execute schema
      await pool.query(schema);

      console.log('✅ Database migration completed successfully!');
    }

    // Run incremental migrations from the migrations directory
    await runMigrations();

    // Verify tables
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📊 Database tables:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

async function runMigrations() {
  // Ensure migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Find migration files
  const migrationsDir = path.join(__dirname, '../database/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('ℹ️  No migrations directory found, skipping');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Check if tables exist (pre-existing deployment without schema_migrations)
  const tablesExist = await pool.query(`
    SELECT COUNT(*) as count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users';
  `);
  const hasExistingSchema = parseInt(tablesExist.rows[0].count) > 0;

  for (const file of files) {
    const version = file.replace('.sql', '');

    // Check if already applied
    const applied = await pool.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [version]
    );

    if (applied.rows.length > 0) {
      console.log(`⏭️  Skipping already applied migration: ${file}`);
      continue;
    }

    // If DB already has tables and this migration number is <= 009,
    // it was applied before schema_migrations tracking existed — mark as applied without running
    const migrationNumber = parseInt(file.split('_')[0], 10);
    if (hasExistingSchema && migrationNumber <= 9) {
      await pool.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
        [version]
      );
      console.log(`📌 Marked pre-existing migration as applied: ${file}`);
      continue;
    }

    // Apply migration
    console.log(`📄 Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    try {
      await pool.query(sql);
      await pool.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      console.log(`✅ Applied migration: ${file}`);
    } catch (error) {
      console.error(`❌ Migration ${file} failed:`, error.message);
      throw error;
    }
  }
}

migrate();
