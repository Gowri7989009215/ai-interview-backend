require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet());
app.use(cors({
    origin: true, // Allow client origin requests
    credentials: true // Allow secure cookies
}));

// Logging and parsing
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Platform API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Routing Handlers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/interview', require('./routes/interview'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/', (req, res) => {
    res.send('ProInterview AI SaaS API is running...');
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error("Global Error Caught:", err.message);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'production' ? {} : err.stack
    });
});

// Database Connection & Admin Seeding
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('MongoDB connected');
        
        // Seed default administrator user if none exists
        try {
            const User = require('./models/User');
            const adminExists = await User.findOne({ role: 'admin' });
            if (!adminExists) {
                const defaultAdmin = new User({
                    username: 'admin',
                    name: 'Default Admin',
                    fullName: 'Default Admin',
                    email: 'admin@prointerview.ai',
                    password: 'adminpassword123', // Will be hashed automatically by pre-save hook
                    role: 'admin',
                    authProvider: 'email',
                    emailVerified: true
                });
                await defaultAdmin.save();
                console.log('Default administrator user seeded successfully! (admin@prointerview.ai / adminpassword123)');
            }
        } catch (seedErr) {
            console.error('Failed to seed default administrator user:', seedErr.message);
        }
    })
    .catch(err => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
