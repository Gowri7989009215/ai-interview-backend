const express = require('express');
const router = express.Router();
const { 
    register, 
    login, 
    getMe, 
    registerSendOTP, 
    registerVerifyOTP, 
    googleAuth, 
    forgotPasswordSendOTP, 
    forgotPasswordVerifyAndReset,
    refresh,
    logout
} = require('../controllers/authController');
const auth = require('../middleware/auth');

// Standard Access Routes
router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getMe);

// Token Management & Security Session Endpoints
router.post('/refresh', refresh);
router.post('/logout', logout);

// OTP Verification & Google OAuth Handlers
router.post('/register/send-otp', registerSendOTP);
router.post('/register/verify-otp', registerVerifyOTP);
router.post('/google', googleAuth);
router.post('/forgot-password/send-otp', forgotPasswordSendOTP);
router.post('/forgot-password/verify', forgotPasswordVerifyAndReset);

module.exports = router;
