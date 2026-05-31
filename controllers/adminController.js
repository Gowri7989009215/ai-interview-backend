const User = require('../models/User');
const Interview = require('../models/Interview');
const AdminLog = require('../models/AdminLog');

// Helper to log admin actions
const logAdminAction = async (action, adminId) => {
    try {
        const log = new AdminLog({
            action,
            userId: adminId
        });
        await log.save();
    } catch (err) {
        console.error("Failed to write admin log:", err);
    }
};

// 1. Get Platform Analytics
exports.getPlatformAnalytics = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalInterviews = await Interview.countDocuments();
        
        // Average Platform Score
        const scoreResult = await Interview.aggregate([
            { $match: { overallScore: { $exists: true } } },
            { $group: { _id: null, avgScore: { $avg: '$overallScore' } } }
        ]);
        const averagePlatformScore = scoreResult.length > 0 ? Math.round(scoreResult[0].avgScore) : 0;

        // Most Popular Roles
        const popularRoles = await Interview.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Weakest Skills Across Platform Users
        const skillAverages = await Interview.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: null,
                    technical: { $avg: '$skillScores.technical' },
                    communication: { $avg: '$skillScores.communication' },
                    clarity: { $avg: '$skillScores.clarity' },
                    relevance: { $avg: '$skillScores.relevance' },
                    depth: { $avg: '$skillScores.depth' }
                }
            }
        ]);

        const weakestSkills = [];
        if (skillAverages.length > 0) {
            const metrics = skillAverages[0];
            const sortedMetrics = [
                { skill: 'Technical Depth', score: metrics.technical || 0 },
                { skill: 'Communication', score: metrics.communication || 0 },
                { skill: 'Clarity', score: metrics.clarity || 0 },
                { skill: 'Relevance', score: metrics.relevance || 0 },
                { skill: 'Context Depth', score: metrics.depth || 0 }
            ].sort((a, b) => a.score - b.score);
            
            weakestSkills.push(...sortedMetrics.slice(0, 3));
        } else {
            weakestSkills.push(
                { skill: 'Technical Depth', score: 0 },
                { skill: 'Communication', score: 0 },
                { skill: 'Clarity', score: 0 }
            );
        }

        res.json({
            totalUsers,
            totalInterviews,
            averagePlatformScore,
            popularRoles,
            weakestSkills
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error retrieving analytics', error: err.message });
    }
};

// 2. Get Platform Leaderboard / Top Performers
exports.getLeaderboard = async (req, res) => {
    try {
        const topPerformers = await User.find({ role: 'user' })
            .sort({ averageScore: -1 })
            .limit(10)
            .select('name fullName email averageScore interviewsTaken avatar profilePicture');
        
        res.json(topPerformers);
    } catch (err) {
        res.status(500).json({ message: 'Server error retrieving leaderboard', error: err.message });
    }
};

// 3. Search and manage Users
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        const filter = { role: 'user' };
        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: 'i' } },
                { fullName: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } },
                { username: { $regex: query, $options: 'i' } }
            ];
        }

        const users = await User.find(filter).select('-password -refreshToken');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error searching users', error: err.message });
    }
};

// 4. View user detail & their interviews
exports.getUserInterviews = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('-password -refreshToken');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const interviews = await Interview.find({ user: userId }).sort({ createdAt: -1 });
        
        await logAdminAction(`Inspected interviews of user ${user.email}`, req.user.id);
        
        res.json({ user, interviews });
    } catch (err) {
        res.status(500).json({ message: 'Server error retrieving user interviews', error: err.message });
    }
};

// 5. Track Anti-Cheat Violations
exports.getViolations = async (req, res) => {
    try {
        const suspiciousInterviews = await Interview.find({ suspiciousEvents: { $gt: 0 } })
            .sort({ suspiciousEvents: -1 })
            .populate('user', 'name fullName email username');
            
        res.json(suspiciousInterviews);
    } catch (err) {
        res.status(500).json({ message: 'Server error retrieving violations', error: err.message });
    }
};

// 6. Get Admin Audit Logs
exports.getAdminLogs = async (req, res) => {
    try {
        const logs = await AdminLog.find()
            .sort({ timestamp: -1 })
            .populate('userId', 'name fullName email role')
            .limit(100);
            
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'Server error retrieving audit logs', error: err.message });
    }
};
