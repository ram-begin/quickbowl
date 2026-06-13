const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const initDB = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                order_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'INR',
                status VARCHAR(50) DEFAULT 'PENDING',
                razorpay_order_id VARCHAR(255),
                razorpay_payment_id VARCHAR(255),
                razorpay_signature VARCHAR(255),
                payment_method VARCHAR(100),
                refund_id VARCHAR(255),
                refund_amount DECIMAL(10,2),
                refund_status VARCHAR(50),
                refund_reason TEXT,
                refunded_at TIMESTAMP,
                failure_reason TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS settlements (
                id SERIAL PRIMARY KEY,
                restaurant_id VARCHAR(255) NOT NULL,
                period_start TIMESTAMP NOT NULL,
                period_end TIMESTAMP NOT NULL,
                total_orders INTEGER DEFAULT 0,
                gross_amount DECIMAL(10,2) DEFAULT 0,
                platform_fee DECIMAL(10,2) DEFAULT 0,
                net_amount DECIMAL(10,2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'PENDING',
                settled_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('✅ Payment tables ready');
    } finally {
        client.release();
    }
};

module.exports = { pool, initDB };