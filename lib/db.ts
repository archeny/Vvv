// by Stenly
import mysql from 'mysql2/promise';

const globalForDb = globalThis as unknown as {
  mysqlPool: mysql.Pool | undefined;
};

export const pool =
  globalForDb.mysqlPool ??
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.mysqlPool = pool;

export async function syncDb() {
  try {
    await pool.execute("SELECT device_id FROM users LIMIT 1");
  } catch (e: any) {
    if (e.code === 'ER_BAD_FIELD_ERROR' || e.message.includes('Unknown column')) {
      try { await pool.execute("ALTER TABLE users ADD COLUMN device_id VARCHAR(255) UNIQUE"); } catch(err){}
      try { await pool.execute("ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL"); } catch(err){}
      try { await pool.execute("ALTER TABLE users MODIFY COLUMN name VARCHAR(255) NULL"); } catch(err){}
    }
  }
  
  try {
    await pool.execute("SELECT reasoning FROM messages LIMIT 1");
  } catch (e: any) {
    if (e.code === 'ER_BAD_FIELD_ERROR' || e.message.includes('Unknown column')) {
      try { await pool.execute("ALTER TABLE messages ADD COLUMN reasoning LONGTEXT"); } catch(err){}
    }
  }

  try {
    await pool.execute("SELECT thinking_time FROM messages LIMIT 1");
  } catch (e: any) {
    if (e.code === 'ER_BAD_FIELD_ERROR' || e.message.includes('Unknown column')) {
      try { await pool.execute("ALTER TABLE messages ADD COLUMN thinking_time INT"); } catch(err){}
    }
  }
}

