const User = require('../models/User');
const Interview = require('../models/Interview');
const claudeService = require('../services/claudeService');

// Map of industry required skills per role
const ROLE_SKILLS_MAP = {
    "Frontend Developer": ["React", "Next.js", "HTML", "CSS", "JavaScript", "TypeScript", "Tailwind CSS", "Jest", "Vite"],
    "Backend Developer": ["Node.js", "Express", "MongoDB", "SQL", "Redis", "Docker", "AWS", "REST API", "System Design"],
    "Full Stack Developer": ["React", "Node.js", "Express", "MongoDB", "SQL", "JavaScript", "TypeScript", "Docker", "AWS", "HTML", "CSS"],
    "React Developer": ["React", "JavaScript", "TypeScript", "Redux", "HTML", "CSS", "Tailwind CSS", "Jest"],
    "Node.js Developer": ["Node.js", "Express", "JavaScript", "TypeScript", "MongoDB", "SQL", "Redis", "REST API"],
    "Java Developer": ["Java", "Spring Boot", "SQL", "Hibernate", "REST API", "Docker", "Git", "OOP"],
    "Python Developer": ["Python", "Django", "Flask", "SQL", "Pandas", "NumPy", "Git", "OOP"],
    "AI Engineer": ["Python", "TensorFlow", "PyTorch", "Machine Learning", "Deep Learning", "NLP", "Pandas", "NumPy"],
    "Data Analyst": ["Python", "SQL", "Excel", "Tableau", "PowerBI", "Pandas", "NumPy", "Statistics"],
    "DevOps Engineer": ["Docker", "Kubernetes", "AWS", "CI/CD", "Linux", "Terraform", "Nginx", "Git"],
    "Cloud Engineer": ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Linux", "Security"]
};

// Default Roadmap structure
const DEFAULT_ROADMAP = [
    { week: 1, title: "Language Foundations", topics: ["JavaScript / Python Basics", "Arrays & Objects", "Asynchronous Programming"], completed: false },
    { week: 2, title: "Framework Core & UI Development", topics: ["React / Backend Routing Basics", "Components & Lifecycle Hooks", "State Management & Optimization"], completed: false },
    { week: 3, title: "Database Systems & Models", topics: ["SQL Schema & Indexing", "NoSQL / MongoDB Integrations", "Query Tuning & Performance"], completed: false },
    { week: 4, title: "System Architecture & API Design", topics: ["RESTful API Security (JWT)", "Microservices Architecture", "Caching Strategies with Redis"], completed: false },
    { week: 5, title: "Data Structures & Algorithms", topics: ["Time & Space Complexity", "Recursion & Dynamic Programming", "Common Sorting & Searching Algorithms"], completed: false },
    { week: 6, title: "Mock Interview & Portfolio Polish", topics: ["Continuous Integration (CI/CD)", "Behavioral Scenario Preparation", "Live Coding Practice Simulations"], completed: false }
];

// 1. Get complete Dashboard Data
exports.getDashboardData = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Seed default roadmap if empty
        if (!user.roadmap || user.roadmap.length === 0) {
            user.roadmap = DEFAULT_ROADMAP;
            await user.save();
        }

        // Fetch interviews history
        const interviews = await Interview.find({ userId: req.user.id }).sort({ createdAt: -1 });

        // Profile metrics calculation
        const completedInterviews = interviews.filter(i => i.status === 'completed');
        const totalInterviews = interviews.length;
        const averageScore = user.averageScore || 0;
        const highestScore = completedInterviews.length > 0 ? Math.max(...completedInterviews.map(i => i.overallScore || 0)) : 0;
        const lowestScore = completedInterviews.length > 0 ? Math.min(...completedInterviews.map(i => i.overallScore || 0)) : 0;
        
        // Success rate: percentage of completed interviews with score >= 70%
        const passedCount = completedInterviews.filter(i => (i.overallScore || 0) >= 70).length;
        const successRate = totalInterviews > 0 ? Math.round((passedCount / totalInterviews) * 100) : 0;

        // Target role skills mapping
        const targetRole = user.targetRole || "Full Stack Developer";
        const targetCompany = user.targetCompany || "Google";
        const requiredSkills = ROLE_SKILLS_MAP[targetRole] || ROLE_SKILLS_MAP["Full Stack Developer"];
        const currentSkills = user.resumeData?.skills || [];
        
        // Calculate missing skills & match percentage
        const currentSkillsLower = currentSkills.map(s => s.toLowerCase());
        const missingSkills = requiredSkills.filter(s => !currentSkillsLower.includes(s.toLowerCase()));
        
        const matchedCount = requiredSkills.length - missingSkills.length;
        const skillMatchPercent = Math.round((matchedCount / requiredSkills.length) * 100);
        
        // Job readiness calculation (weighted combination of skill match & average score)
        const jobReadiness = Math.round((skillMatchPercent * 0.4) + (averageScore * 0.6));

        // Profile completion score calculation
        let profileStrength = 30; // base score
        if (currentSkills.length > 0) profileStrength += 20;
        if (user.resumePath) profileStrength += 15;
        if (totalInterviews > 0) profileStrength += 20;
        if (averageScore >= 70) profileStrength += 15;
        
        // Save computed profile strength
        user.profileStrength = Math.min(100, profileStrength);
        await user.save();

        // Weekly and Monthly performance progress mocks
        const weeklyProgress = [35, 45, 52, averageScore || 65];
        const monthlyProgress = [40, 50, 60, averageScore || 70];

        // Achievements system badges
        const achievementsList = [];
        if (totalInterviews >= 1) achievementsList.push("First Step");
        if (totalInterviews >= 5) achievementsList.push("Consistent Learner");
        if (totalInterviews >= 10) achievementsList.push("Interview Veteran");
        if (averageScore >= 90) achievementsList.push("Score Master");
        if (completedInterviews.some(i => i.mode === "Coding" && i.overallScore >= 80)) achievementsList.push("Coding Ninja");

        // AI Career Coach insights
        const coachInsights = [
            `Based on your profile, you match ${skillMatchPercent}% of required skills for ${targetRole}.`,
            missingSkills.length > 0 
                ? `Focus on learning ${missingSkills.slice(0, 3).join(', ')} to boost your readiness.` 
                : "You possess all key foundational skills for this role! Focus on advanced optimization.",
            averageScore > 75 
                ? "Your average interview score is strong. You are ready to start applying for live roles." 
                : "Try to take 2-3 more mock practice rounds to push your average score above 75%.",
            `Your profile strength score is at ${user.profileStrength}%. Complete more sessions to reach Expert status.`
        ];

        // Return structured dashboard object
        res.json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                name: user.name || user.username,
                fullName: user.fullName || user.username,
                avatar: user.avatar || user.profilePicture,
                role: user.role,
                targetRole,
                targetCompany,
                profileStrength: user.profileStrength,
                learningTracker: user.learningTracker || {
                    coursesCompleted: 2,
                    topicsLearned: 14,
                    projectsBuilt: 3,
                    codingChallengesSolved: 28,
                    totalStudyHours: 42,
                    dailyStreak: 5
                },
                roadmap: user.roadmap,
                achievements: achievementsList
            },
            analytics: {
                totalInterviews,
                averageScore,
                highestScore,
                lowestScore,
                successRate,
                weeklyProgress,
                monthlyProgress
            },
            roleTracking: {
                targetRole,
                requiredSkills,
                currentSkills,
                skillMatchPercent,
                missingSkills,
                jobReadiness
            },
            insights: coachInsights
        });
    } catch (err) {
        console.error("Dashboard API Error:", err);
        res.status(500).json({ message: "Server error retrieving dashboard metrics", error: err.message });
    }
};

// 2. Update user preferences
exports.updatePreferences = async (req, res) => {
    try {
        const { targetRole, targetCompany } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (targetRole) user.targetRole = targetRole;
        if (targetCompany) user.targetCompany = targetCompany;

        await user.save();
        res.json({ message: "Preferences updated successfully", user });
    } catch (err) {
        res.status(500).json({ message: "Failed to update preferences", error: err.message });
    }
};

// 3. Toggle roadmap task completion
exports.toggleRoadmapTask = async (req, res) => {
    try {
        const { weekNum } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.roadmap = user.roadmap.map(item => {
            if (item.week === weekNum) {
                item.completed = !item.completed;
            }
            return item;
        });

        await user.save();
        res.json({ message: "Roadmap updated successfully", roadmap: user.roadmap });
    } catch (err) {
        res.status(500).json({ message: "Failed to update roadmap task", error: err.message });
    }
};

// 4. Chat with AI Career Coach
exports.askCareerCoach = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ message: "Message parameter is required" });

        const user = await User.findById(req.user.id);
        const targetRole = user?.targetRole || "Full Stack Developer";
        const currentSkills = user?.resumeData?.skills || [];

        // Build customized system prompt for the coach
        const systemPrompt = `You are a staff-level career advisor and mentor at ProInterview AI. You are coaching a candidate who is targeting the "${targetRole}" role. Their current skills are: ${JSON.stringify(currentSkills)}. Provide direct, actionable career advice. Be encouraging, precise, and keep responses relatively concise.`;

        // Direct call to claudeService text generation
        // Fallback text generator is handled transparently inside the claudeService!
        const coachResponse = await claudeService.evaluateAnswer(
            `User query: "${message}"`,
            "Generate career coach response.",
            targetRole,
            "Senior"
        );

        res.json({
            reply: coachResponse.feedback || "Based on your current skill matrix, I recommend focusing on building practical microservices and practicing algorithmic complexity (O(N) bounds) for your upcoming technical sessions."
        });
    } catch (err) {
        console.error("AI Coach Error:", err);
        res.json({
            reply: "I recommend focusing on core computer science foundations, sharpening Javascript recursion algorithms, and completing 2 more mock sessions on ProInterview AI."
        });
    }
};
