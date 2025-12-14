// backend/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Endpoint untuk login
router.post('/login', authController.login);

// Endpoint untuk verify token (protected route)
router.get('/me', verifyToken, authController.getCurrentUser);

module.exports = router;
