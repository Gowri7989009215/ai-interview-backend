const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const { OAuth2Client } = require('google-auth-library');

// Helper to generate access and refresh tokens, saving refresh token to user
const generateTokens = async (user) => {
    const accessToken = jwt.sign(
        { id: user._id, role: user.role }, 
        process.env.JWT_SECRET, 
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { id: user._id }, 
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, 
        { expiresIn: '7d' }
    );
    
    user.refreshToken = refreshToken;
    await user.save();
    
    return { accessToken, refreshToken };
};

// Send refresh token as secure cookie
const sendRefreshTokenCookie = (res, token) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

// Helper to generate a unique username from email or name
const generateUniqueUsername = async (email, fullName) => {
    let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    if (!baseUsername) {
        baseUsername = (fullName || 'user').replace(/[^a-zA-Z0-9]/g, '');
    }
    
    let username = baseUsername.toLowerCase();
    let exists = await User.findOne({ username });
    let attempts = 0;
    
    while (exists && attempts < 10) {
        const rand = crypto.randomInt(1000, 9999).toString();
        username = `${baseUsername.toLowerCase()}${rand}`;
        exists = await User.findOne({ username });
        attempts++;
    }
    return username;
};

// Existing Register (maintaining backward compatibility)
exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        user = new User({ 
            username, 
            email, 
            password,
            fullName: username,
            name: username,
            authProvider: 'email',
            emailVerified: true
        });
        await user.save();

        const { accessToken, refreshToken } = await generateTokens(user);
        sendRefreshTokenCookie(res, refreshToken);

        res.status(201).json({ 
            token: accessToken, 
            user: { id: user._id, username, email, role: user.role } 
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Send OTP for Register
exports.registerSendOTP = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: 'All fields (fullName, email, password) are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        // Enforce OTP rate limiting
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const lastOtp = await OTP.findOne({ email, purpose: 'signup', createdAt: { $gte: oneMinuteAgo } });

        if (lastOtp) {
            const timePassed = Math.round((now.getTime() - lastOtp.createdAt.getTime()) / 1000);
            const secondsLeft = 60 - timePassed;
            return res.status(429).json({ 
                message: `Please wait ${secondsLeft} seconds before requesting another OTP.` 
            });
        }

        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const otpCount = await OTP.countDocuments({ email, createdAt: { $gte: oneHourAgo } });
        if (otpCount >= 5) {
            return res.status(429).json({ 
                message: 'Too many OTP requests. Please try again in an hour.' 
            });
        }

        // Generate 6-digit OTP
        const otpVal = crypto.randomInt(100000, 999999).toString();
        const expiryMin = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
        const expiresAt = new Date(now.getTime() + expiryMin * 60 * 1000);

        // Delete existing registration OTPs for this email
        await OTP.deleteMany({ email, purpose: 'signup' });

        // Save OTP
        const otpDoc = new OTP({
            email,
            otp: otpVal,
            purpose: 'signup',
            userData: {
                fullName,
                passwordHash: password
            },
            expiresAt
        });
        await otpDoc.save();

        // Send Email
        const emailContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2>Confirm your ProInterview AI Registration</h2>
                <p>Thank you for signing up! Use the following One-Time Password (OTP) to complete your registration:</p>
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #0284c7; margin: 20px 0; border-radius: 8px;">
                    ${otpVal}
                </div>
                <p>This OTP is valid for ${expiryMin} minutes. If you did not request this code, please ignore this email.</p>
                <br/>
                <p>Best regards,<br/>The ProInterview AI Team</p>
            </div>
        `;

        await sendEmail({
            to: email,
            subject: `${otpVal} is your ProInterview AI Verification Code`,
            html: emailContent
        });

        res.status(200).json({ message: 'OTP sent to email successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to send OTP', error: err.message });
    }
};

// Verify OTP & Register
exports.registerVerifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required.' });
        }

        // Find matching OTP
        const otpRecord = await OTP.findOne({ email, purpose: 'signup' });
        if (!otpRecord) {
            return res.status(400).json({ message: 'No verification request found for this email.' });
        }

        if (otpRecord.expiresAt < new Date()) {
            await OTP.deleteMany({ email, purpose: 'signup' });
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (otpRecord.otp !== otp) {
            return res.status(400).json({ message: 'Invalid verification code. Please try again.' });
        }

        // Verify credentials still unique
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            await OTP.deleteMany({ email, purpose: 'signup' });
            return res.status(400).json({ message: 'User with this email already exists.' });
        }

        // Create User
        const { fullName, passwordHash } = otpRecord.userData;
        const username = await generateUniqueUsername(email, fullName);

        const newUser = new User({
            username,
            name: fullName,
            fullName,
            email,
            password: passwordHash,
            authProvider: 'email',
            emailVerified: true
        });
        await newUser.save();

        // Delete verified OTP record
        await OTP.deleteMany({ email, purpose: 'signup' });

        const { accessToken, refreshToken } = await generateTokens(newUser);
        sendRefreshTokenCookie(res, refreshToken);

        res.status(201).json({
            token: accessToken,
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                name: newUser.name,
                fullName: newUser.fullName,
                role: newUser.role,
                profilePicture: newUser.profilePicture,
                avatar: newUser.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Verification failed', error: err.message });
    }
};

// Standard Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        // If Google user and has no password
        if (user.authProvider === 'google' && !user.password) {
            return res.status(400).json({ 
                message: 'This account was created with Google. Please click "Continue with Google" to log in.' 
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const { accessToken, refreshToken } = await generateTokens(user);
        sendRefreshTokenCookie(res, refreshToken);

        res.json({
            token: accessToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                name: user.name || user.username,
                fullName: user.fullName || user.username,
                role: user.role,
                profilePicture: user.profilePicture,
                avatar: user.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Google Auth
exports.googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ message: 'Google credential token is required' });
        }

        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
            console.error('GOOGLE_CLIENT_ID is not configured in environment.');
            return res.status(500).json({ message: 'Google Auth is not configured on the server.' });
        }

        const client = new OAuth2Client(googleClientId);
        
        let payload;
        try {
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: googleClientId,
            });
            payload = ticket.getPayload();
        } catch (verifyError) {
            return res.status(400).json({ message: 'Failed to verify Google token', error: verifyError.message });
        }

        const { sub: googleId, email, name: fullName, picture: profilePicture } = payload;

        let user = await User.findOne({ $or: [{ email }, { googleId }] });

        if (user) {
            let updated = false;
            if (!user.googleId) {
                user.googleId = googleId;
                updated = true;
            }
            if (!user.profilePicture) {
                user.profilePicture = profilePicture;
                user.avatar = profilePicture;
                updated = true;
            }
            if (!user.fullName) {
                user.fullName = fullName;
                user.name = fullName;
                updated = true;
            }
            if (!user.emailVerified) {
                user.emailVerified = true;
                updated = true;
            }
            if (updated) {
                await user.save();
            }
        } else {
            const username = await generateUniqueUsername(email, fullName);
            user = new User({
                username,
                fullName,
                name: fullName,
                email,
                googleId,
                profilePicture,
                avatar: profilePicture,
                authProvider: 'google',
                emailVerified: true
            });
            await user.save();
        }

        const { accessToken, refreshToken } = await generateTokens(user);
        sendRefreshTokenCookie(res, refreshToken);

        res.status(200).json({
            token: accessToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                name: user.name,
                fullName: user.fullName,
                role: user.role,
                profilePicture: user.profilePicture,
                avatar: user.avatar
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Google authentication failed', error: err.message });
    }
};

// Send Forgot Password OTP
exports.forgotPasswordSendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email address is required.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'No user account found with this email address.' });
        }

        // Rate limiting
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const lastOtp = await OTP.findOne({ email, purpose: 'forgot-password', createdAt: { $gte: oneMinuteAgo } });

        if (lastOtp) {
            const timePassed = Math.round((now.getTime() - lastOtp.createdAt.getTime()) / 1000);
            const secondsLeft = 60 - timePassed;
            return res.status(429).json({ 
                message: `Please wait ${secondsLeft} seconds before requesting another OTP.` 
            });
        }

        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const otpCount = await OTP.countDocuments({ email, createdAt: { $gte: oneHourAgo } });
        if (otpCount >= 5) {
            return res.status(429).json({ 
                message: 'Too many OTP requests. Please try again in an hour.' 
            });
        }

        // Generate OTP
        const otpVal = crypto.randomInt(100000, 999999).toString();
        const expiryMin = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
        const expiresAt = new Date(now.getTime() + expiryMin * 60 * 1000);

        // Delete existing forgot password OTPs for this email
        await OTP.deleteMany({ email, purpose: 'forgot-password' });

        const otpDoc = new OTP({
            email,
            otp: otpVal,
            purpose: 'forgot-password',
            expiresAt
        });
        await otpDoc.save();

        // Send Email
        const emailContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2>Reset Your ProInterview AI Password</h2>
                <p>We received a request to reset your password. Use the following verification code to proceed:</p>
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #0284c7; margin: 20px 0; border-radius: 8px;">
                    ${otpVal}
                </div>
                <p>This code is valid for ${expiryMin} minutes. If you did not request a password reset, please ignore this email.</p>
                <br/>
                <p>Best regards,<br/>The ProInterview AI Team</p>
            </div>
        `;

        await sendEmail({
            to: email,
            subject: `${otpVal} is your Password Reset Verification Code`,
            html: emailContent
        });

        res.status(200).json({ message: 'Password reset OTP sent to email successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to send reset OTP', error: err.message });
    }
};

// Verify OTP & Reset Password
exports.forgotPasswordVerifyAndReset = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: 'Email, OTP, and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
        }

        const otpRecord = await OTP.findOne({ email, purpose: 'forgot-password' });
        if (!otpRecord) {
            return res.status(400).json({ message: 'No password reset session found for this email.' });
        }

        if (otpRecord.expiresAt < new Date()) {
            await OTP.deleteMany({ email, purpose: 'forgot-password' });
            return res.status(400).json({ message: 'OTP code has expired. Please try again.' });
        }

        if (otpRecord.otp !== otp) {
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'No user found.' });
        }

        user.password = newPassword;
        await user.save();

        // Delete verified OTP record
        await OTP.deleteMany({ email, purpose: 'forgot-password' });

        res.status(200).json({ message: 'Password updated successfully. You can now log in.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to reset password', error: err.message });
    }
};

// Refresh token rotation
exports.refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token missing.' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.id, refreshToken });
        if (!user) {
            return res.status(401).json({ message: 'Invalid or expired refresh token.' });
        }

        // Rotate tokens
        const tokens = await generateTokens(user);
        sendRefreshTokenCookie(res, tokens.refreshToken);

        res.json({
            token: tokens.accessToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (err) {
        res.status(401).json({ message: 'Token refresh failed.', error: err.message });
    }
};

// Logout session
exports.logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (refreshToken) {
            const user = await User.findOne({ refreshToken });
            if (user) {
                user.refreshToken = null;
                await user.save();
            }
        }
        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Logout failed', error: err.message });
    }
};

// Get current user profile
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
