const pool = require('../config/db');

const createUsersTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id              SERIAL PRIMARY KEY,
      first_name      VARCHAR(50)  NOT NULL,
      last_name       VARCHAR(50)  NOT NULL,
      email           VARCHAR(100) UNIQUE NOT NULL,
      phone           VARCHAR(20)  NOT NULL,
      password        VARCHAR(255) NOT NULL,
      role            VARCHAR(20)  DEFAULT 'customer',
      penalty_amount  DECIMAL(10,2) DEFAULT 0.00,
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS restaurant_owners (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      restaurant_id   VARCHAR(100),
      restaurant_name VARCHAR(100) NOT NULL,
      is_verified     BOOLEAN DEFAULT FALSE,
      created_at      TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token       VARCHAR(500) NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW(),
      expires_at  TIMESTAMP NOT NULL
    );
  `;

  try {
    await pool.query(query);
    console.log('✅ Users table ready');
  } catch (err) {
    console.error('❌ Error creating table:', err);
  }
};

module.exports = { createUsersTable };