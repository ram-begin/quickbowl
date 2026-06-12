const express = require('express');
const router  = express.Router();
const {
  register,
  registerRestaurantOwner,
  login,
  getProfile,
  verifyToken,
  updatePenalty,
  clearPenalty
} = require('../controllers/authController');
const { protect, restaurantOwnerOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// ── Validation middleware ─────────────────────────────
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg
    });
  }
  next();
};

// ── Register rules ────────────────────────────────────
const registerRules = [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('email').trim().isEmail().withMessage('Valid email required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
];

// ── Restaurant owner rules ────────────────────────────
const restaurantOwnerRules = [
  ...registerRules,
  body('restaurant_name')
    .trim()
    .notEmpty().withMessage('Restaurant name is required')
];

// ── Login rules ───────────────────────────────────────
const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required')
];

// ── Routes ────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', registerRules, handleValidation, register);

// POST /api/auth/register/restaurant
router.post('/register/restaurant', restaurantOwnerRules, handleValidation, registerRestaurantOwner);

// POST /api/auth/login
router.post('/login', loginRules, handleValidation, login);

// GET /api/auth/profile (protected)
router.get('/profile', protect, getProfile);

// GET /api/auth/verify (called by other services)
router.get('/verify', verifyToken);

// POST /api/auth/penalty/add (called by order service)
router.post('/penalty/add', updatePenalty);

// POST /api/auth/penalty/clear (called by payment service)
router.post('/penalty/clear', clearPenalty);

module.exports = router;