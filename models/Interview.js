const mongoose = require('mongoose');

const InterviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    role: String,
    level: String,
    experienceLevel: String,
    mode: {
        type: String,
        enum: ['Technical', 'HR', 'Behavioral', 'Coding', 'Mixed'],
    },
    questions: [
        {
            questionText: String,
            answerText: String,
            aiFeedback: String,
            score: Number,
            category: String,
            isFollowUp: Boolean,
        },
    ],
    overallScore: Number,
    finalScore: Number,
    skillScores: {
        technical: Number,
        communication: Number,
        clarity: Number,
        relevance: Number,
        depth: Number,
    },
    status: {
        type: String,
        enum: ['in-progress', 'completed'],
        default: 'in-progress',
    },
    suspiciousEvents: {
        type: Number,
        default: 0,
    },
    startTime: {
        type: Date,
        default: Date.now,
    },
    endTime: Date,
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Interview', InterviewSchema);
