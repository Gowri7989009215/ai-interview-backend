const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
    },
    fullName: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: false,
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    avatar: String,
    profilePicture: String,
    authProvider: {
        type: String,
        enum: ['email', 'google'],
        default: 'email',
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    interviewsTaken: {
        type: Number,
        default: 0,
    },
    averageScore: {
        type: Number,
        default: 0,
    },
    resumePath: String,
    resumeData: {
        skills: [String],
        experience: [Object],
        education: [Object],
        rawText: String,
    },
    targetRole: {
        type: String,
        default: 'Full Stack Developer',
    },
    targetCompany: {
        type: String,
        default: 'Google',
    },
    roadmap: [{
        week: Number,
        title: String,
        topics: [String],
        completed: { type: Boolean, default: false }
    }],
    learningTracker: {
        coursesCompleted: { type: Number, default: 0 },
        topicsLearned: { type: Number, default: 0 },
        projectsBuilt: { type: Number, default: 0 },
        codingChallengesSolved: { type: Number, default: 0 },
        totalStudyHours: { type: Number, default: 0 },
        dailyStreak: { type: Number, default: 0 }
    },
    achievements: {
        type: [String],
        default: ['First Interview']
    },
    profileStrength: {
        type: Number,
        default: 45
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Pre-save operations: hash password if modified and update updatedAt timestamp
UserSchema.pre('save', async function () {
    this.updatedAt = Date.now();
    
    if (!this.isModified('password')) return;
    if (!this.password) return;
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
UserSchema.methods.comparePassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
