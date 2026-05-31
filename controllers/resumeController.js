const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const User = require('../models/User');
const Resume = require('../models/Resume');
const claudeService = require('../services/claudeService');

exports.uploadResume = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfParser = new PDFParse({ data: dataBuffer });
        await pdfParser.load();
        const data = await pdfParser.getText();

        if (!data.text || data.text.trim().length === 0) {
            return res.status(400).json({ message: 'Failed to read text content from PDF. Make sure it is not scanned/an image.' });
        }

        // Call Claude/Gemini analysis service
        const extractedData = await claudeService.analyzeResume(data.text);

        // 1. Save Resume document
        const newResume = new Resume({
            userId: req.user.id,
            originalFile: req.file.originalname,
            extractedSkills: extractedData.extractedSkills || [],
            extractedProjects: extractedData.extractedProjects || [],
            extractedExperience: extractedData.extractedExperience || [],
            extractedEducation: extractedData.extractedEducation || [],
            extractedCertifications: extractedData.extractedCertifications || []
        });
        await newResume.save();

        // 2. Update User model (maintains backwards compatibility)
        await User.findByIdAndUpdate(req.user.id, {
            resumePath: req.file.path,
            resumeData: {
                skills: extractedData.extractedSkills || [],
                experience: extractedData.extractedExperience || [],
                education: extractedData.extractedEducation || [],
                rawText: data.text
            }
        });

        res.json({ 
            message: 'Resume uploaded and parsed successfully', 
            data: extractedData 
        });
    } catch (err) {
        console.error("Resume Upload Parsing Error:", err);
        res.status(500).json({ message: 'Server error parsing resume', error: err.message });
    }
};
