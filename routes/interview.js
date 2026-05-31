const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
    startInterview, 
    submitAnswer, 
    getInterviewById, 
    getReport,
    runTests,
    getHistory
} = require('../controllers/interviewController');

router.post('/start', auth, startInterview);
router.post('/submit', auth, submitAnswer);
router.post('/run-tests', auth, runTests);
router.get('/history', auth, getHistory);
router.get('/:id', auth, getInterviewById);
router.get('/:id/report', auth, getReport);

module.exports = router;
