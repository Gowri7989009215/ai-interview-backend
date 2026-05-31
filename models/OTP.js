const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    otp: {
        type: String,
        required: true,
    },
    purpose: {
        type: String,
        required: true,
        enum: ['signup', 'forgot-password'],
    },
    userData: {
        fullName: String,
        passwordHash: String, // Store plaintext or hashed password for signup. We will store hashed/plaintext.
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // TTL index: expires at the exact date specified by expiresAt
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('OTP', OTPSchema);
