const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
    },
    interviewId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview',
        required: true,
    },
    answer: {
        type: String,
        required: true,
    },
    duration: {
        type: Number, // duration in seconds
        default: 0,
    },
    relevanceScore: {
        type: Number,
        default: 0,
    },
    technicalScore: {
        type: Number,
        default: 0,
    },
    clarityScore: {
        type: Number,
        default: 0,
    },
    communicationScore: {
        type: Number,
        default: 0,
    },
    totalScore: {
        type: Number,
        default: 0,
    },
    feedback: String,
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Answer', AnswerSchema);
