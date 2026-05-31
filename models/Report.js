const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    interviewId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview',
        required: true,
    },
    strengths: [String],
    weaknesses: [String],
    skillGaps: [String],
    recommendations: {
        roles: [String],
        roadmap: String,
        topics: [String],
        projects: [String],
    },
    radarMetrics: {
        technical: Number,
        communication: Number,
        clarity: Number,
        relevance: Number,
        depth: Number,
    },
    overallRating: {
        type: Number,
        default: 0,
    },
    hiringReadinessScore: {
        type: Number,
        default: 0,
    },
    confidenceLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Report', ReportSchema);
