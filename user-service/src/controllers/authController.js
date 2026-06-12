const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ── Generate JWT ──────────────────────────────────────
const generateToken = (user) => {
  return jwt.sign(
    {
      id:    user.id,
      email: user.email,
      role:  user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// ── Register Customer ─────────────────────────────────
const register = async (req, res) => {
  const { first_name, last_name, email, phone, password } = req.body;

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const salt           = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5, 'customer')
       RETURNING id, first_name, last_name, email, phone, role, created_at`,
      [first_name, last_name, email, phone, hashedPassword]
    );

    const user  = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id:         user.id,
        first_name: user.first_name,
        last_name:  user.last_name,
        email:      user.email,
        phone:      user.phone,
        role:       user.role,
        created_at: user.created_at
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
};

// ── Register Restaurant Owner ─────────────────────────
const registerRestaurantOwner = async (req, res) => {
  const { first_name, last_name, email, phone, password, restaurant_name } = req.body;

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const salt           = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5, 'restaurant_owner')
       RETURNING id, first_name, last_name, email, phone, role, created_at`,
      [first_name, last_name, email, phone, hashedPassword]
    );

    const user = result.rows[0];

    await pool.query(
      `INSERT INTO restaurant_owners (user_id, restaurant_name, is_verified)
       VALUES ($1, $2, FALSE)`,
      [user.id, restaurant_name]
    );

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Restaurant owner account created. Pending verification.',
      token,
      user: {
        id:              user.id,
        first_name:      user.first_name,
        last_name:       user.last_name,
        email:           user.email,
        phone:           user.phone,
        role:            user.role,
        restaurant_name: restaurant_name,
        is_verified:     false,
        created_at:      user.created_at
      }
    });

  } catch (err) {
    console.error('Register restaurant owner error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
};

// ── Login ─────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user    = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken(user);

    let restaurantDetails = null;
    if (user.role === 'restaurant_owner') {
      const ownerResult = await pool.query(
        'SELECT * FROM restaurant_owners WHERE user_id = $1',
        [user.id]
      );
      if (ownerResult.rows.length > 0) {
        restaurantDetails = ownerResult.rows[0];
      }
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id:            user.id,
        first_name:    user.first_name,
        last_name:     user.last_name,
        email:         user.email,
        phone:         user.phone,
        role:          user.role,
        penalty_amount: user.penalty_amount,
        restaurant:    restaurantDetails,
        created_at:    user.created_at
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
};

// ── Get Profile ───────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email,
       phone, role, penalty_amount, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    let restaurantDetails = null;
    if (user.role === 'restaurant_owner') {
      const ownerResult = await pool.query(
        'SELECT * FROM restaurant_owners WHERE user_id = $1',
        [user.id]
      );
      if (ownerResult.rows.length > 0) {
        restaurantDetails = ownerResult.rows[0];
      }
    }

    res.status(200).json({
      success: true,
      user: { ...user, restaurant: restaurantDetails }
    });

  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ── Verify Token (called by other services) ───────────
const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    res.status(200).json({
      success: true,
      user: decoded
    });

  } catch (err) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// ── Update Penalty ────────────────────────────────────
const updatePenalty = async (req, res) => {
  const { user_id, amount } = req.body;

  try {
    await pool.query(
      `UPDATE users SET penalty_amount = penalty_amount + $1
       WHERE id = $2`,
      [amount, user_id]
    );

    res.status(200).json({
      success: true,
      message: `Penalty of ₹${amount} added to user`
    });

  } catch (err) {
    console.error('Update penalty error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ── Clear Penalty (after penalty is paid) ────────────
const clearPenalty = async (req, res) => {
  const { user_id } = req.body;

  try {
    await pool.query(
      'UPDATE users SET penalty_amount = 0 WHERE id = $1',
      [user_id]
    );

    res.status(200).json({
      success: true,
      message: 'Penalty cleared successfully'
    });

  } catch (err) {
    console.error('Clear penalty error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  register,
  registerRestaurantOwner,
  login,
  getProfile,
  verifyToken,
  updatePenalty,
  clearPenalty
};