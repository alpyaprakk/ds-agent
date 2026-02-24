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

    // Read schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📄 Running schema.sql...');

    // Execute schema
    await pool.query(schema);

    console.log('✅ Database migration completed successfully!');

    // Verify tables
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📊 Created tables:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
