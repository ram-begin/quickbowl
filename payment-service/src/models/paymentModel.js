const { pool } = require('../config/db');

const Payment = {
    // Find by ID
    findById: async (id) => {
        const result = await pool.query('SELECT * FROM payments WHERE id=$1', [id]);
        return result.rows[0];
    },

    // Find by order ID
    findByOrderId: async (orderId) => {
        const result = await pool.query(
            'SELECT * FROM payments WHERE order_id=$1 ORDER BY created_at DESC',
            [orderId]
        );
        return result.rows;
    },

    // Find by user ID
    findByUserId: async (userId) => {
        const result = await pool.query(
            'SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    },

    // Update status
    updateStatus: async (id, status) => {
        const result = await pool.query(
            `UPDATE payments SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
            [status, id]
        );
        return result.rows[0];
    },
};

module.exports = Payment;