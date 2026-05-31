const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
    getDashboardData, 
    updatePreferences, 
    toggleRoadmapTask, 
    askCareerCoach 
} = require('../controllers/dashboardController');

// All dashboard endpoints require authentication
router.get('/', auth, getDashboardData);
router.post('/preferences', auth, updatePreferences);
router.post('/roadmap/toggle', auth, toggleRoadmapTask);
router.post('/coach', auth, askCareerCoach);

module.exports = router;
