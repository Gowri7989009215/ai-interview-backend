const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
    getPlatformAnalytics,
    getLeaderboard,
    searchUsers,
    getUserInterviews,
    getViolations,
    getAdminLogs
} = require('../controllers/adminController');

// All admin routes require active token and admin privilege role
router.use(auth, admin);

router.get('/analytics', getPlatformAnalytics);
router.get('/leaderboard', getLeaderboard);
router.get('/users', searchUsers);
router.get('/users/:userId/interviews', getUserInterviews);
router.get('/violations', getViolations);
router.get('/logs', getAdminLogs);

module.exports = router;
