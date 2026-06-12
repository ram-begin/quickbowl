const jwt = require('jsonwebtoken');

// ── Protect route — any logged in user ────────────────
const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user      = decoded;
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// ── Restrict to customer only ─────────────────────────
const customerOnly = (req, res, next) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Customers only.'
    });
  }
  next();
};

// ── Restrict to restaurant owner only ────────────────
const restaurantOwnerOnly = (req, res, next) => {
  if (req.user.role !== 'restaurant_owner') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Restaurant owners only.'
    });
  }
  next();
};

module.exports = { protect, customerOnly, restaurantOwnerOnly };