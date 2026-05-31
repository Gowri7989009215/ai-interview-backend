const mongoose = require('mongoose');

const ResumeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    originalFile: {
        type: String,
        required: true,
    },
    extractedSkills: [String],
    extractedProjects: [Object],
    extractedExperience: [Object],
    extractedEducation: [Object],
    extractedCertifications: [String],
    uploadedAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Resume', ResumeSchema);
