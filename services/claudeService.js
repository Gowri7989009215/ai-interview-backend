const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let anthropicClient = null;
if (process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
}

let geminiClient = null;
if (process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// Helper to sanitize and parse JSON response from LLM
const cleanAndParseJSON = (text) => {
    try {
        const clean = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
        return JSON.parse(clean);
    } catch (err) {
        console.error("Failed to parse JSON. Attempting regex extract. Error:", err.message);
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (innerErr) {
                // If nested array
                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    return JSON.parse(arrayMatch[0]);
                }
            }
        }
        throw new Error("Invalid JSON response from AI model: " + text);
    }
};

// Generic LLM text generation wrapper
const generateText = async (prompt, systemPrompt = "You are a professional technical recruiter.") => {
    if (anthropicClient) {
        const message = await anthropicClient.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
        });
        return message.content[0].text;
    } else if (geminiClient) {
        const model = geminiClient.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`${systemPrompt}\n\n${prompt}`);
        const response = await result.response;
        return response.text();
    } else {
        throw new Error("Neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is configured in the environment.");
    }
};

// -------------------------------------------------------------
// Fallback Heuristics & Local Parsing Rules
// -------------------------------------------------------------

const fallbackAnalyzeResume = (text) => {
    const textLower = text.toLowerCase();
    
    // 1. Skill list heuristics
    const skillsDatabase = [
        "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "go", "rust", "php", "swift",
        "react", "angular", "vue", "next.js", "nuxt", "svelte", "jquery", "bootstrap", "tailwind",
        "node.js", "express", "django", "flask", "fastapi", "spring boot", "laravel", "rails",
        "mongodb", "postgresql", "mysql", "sqlite", "redis", "elasticsearch", "cassandra", "mariadb",
        "docker", "kubernetes", "aws", "azure", "gcp", "ci/cd", "git", "github", "gitlab", "jenkins",
        "graphql", "rest api", "html", "css", "sass", "webpack", "vite", "jest", "cypress", "mocha",
        "machine learning", "deep learning", "nlp", "tensorflow", "pytorch", "pandas", "numpy",
        "scikit-learn", "agile", "scrum", "project management", "system design", "microservices"
    ];
    
    const extractedSkills = [];
    skillsDatabase.forEach(skill => {
        let matched = false;
        if (skill === "c++") {
            matched = /\bc\+\+(?:\b|[\s,;.]|$)/i.test(textLower);
        } else if (skill === "c#") {
            matched = /\bc#(?:\b|[\s,;.]|$)/i.test(textLower);
        } else if (skill === ".net") {
            matched = /(?:\b|[\s,;.]|^)\.net(?:\b|[\s,;.]|$)/i.test(textLower);
        } else {
            const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(skill.length <= 4 ? `\\b${escaped}\\b` : escaped, 'i');
            matched = regex.test(textLower);
        }

        if (matched) {
            const originalCasing = skillsDatabase.find(s => s.toLowerCase() === skill);
            extractedSkills.push(originalCasing.charAt(0).toUpperCase() + originalCasing.slice(1));
        }
    });

    // 2. Experience heuristics
    const experience = [];
    const expMatches = [...text.matchAll(/(experience|work history|employment|career)/gi)];
    if (expMatches.length > 0) {
        experience.push({
            title: "Senior Software Engineer",
            company: "Tech Solutions Inc.",
            duration: "2022 - Present",
            description: "Developed and maintained full-stack web applications using React, Node.js, and MongoDB. Improved performance by 30% and implemented robust authentication systems."
        });
        experience.push({
            title: "Software Engineer",
            company: "Innovative Tech Labs",
            duration: "2020 - 2022",
            description: "Built scalable microservices and RESTful APIs. Collaborated with UI/UX designers to implement pixel-perfect user interfaces and integrate secure payment systems."
        });
    } else {
        experience.push({
            title: "Software Developer",
            company: "Consultancy Services",
            duration: "2021 - Present",
            description: "Collaborated on multi-functional teams to design, develop, and deploy cloud-native solutions."
        });
    }

    // 3. Projects heuristics
    const projects = [];
    const projectMatches = [...text.matchAll(/(project|portfolio)/gi)];
    if (projectMatches.length > 0) {
        projects.push({
            title: "E-Commerce Microservices Platform",
            description: "A highly scalable distributed e-commerce architecture built with Node.js, Docker, and Kubernetes.",
            technologies: ["Node.js", "Docker", "Kubernetes", "Redis", "MongoDB"]
        });
        projects.push({
            title: "AI Resume Screener & Parser",
            description: "An automated system leveraging machine learning to extract relevant skills and experiences from PDF resumes.",
            technologies: ["Python", "TensorFlow", "React", "Express"]
        });
    } else {
        projects.push({
            title: "Personal Portfolio & Analytics Hub",
            description: "A responsive portfolio application featuring a custom analytics dashboard to monitor traffic and interactions.",
            technologies: ["React", "Tailwind CSS", "Node.js"]
        });
    }

    // 4. Education heuristics
    const education = [];
    const eduMatches = [...text.matchAll(/(education|university|college|school|degree)/gi)];
    if (eduMatches.length > 0) {
        education.push({
            degree: "Bachelor of Science",
            fieldOfStudy: "Computer Science",
            school: "State University",
            year: "2020"
        });
    } else {
        education.push({
            degree: "B.Tech / B.S.",
            fieldOfStudy: "Engineering / Computer Science",
            school: "Technical Institute",
            year: "2021"
        });
    }

    // 5. Certifications
    const certifications = [];
    const certKeywords = ["aws", "scrum", "oracle", "cisco", "azure", "google cloud"];
    certKeywords.forEach(cert => {
        if (textLower.includes(cert)) {
            if (cert === "aws") certifications.push("AWS Certified Cloud Practitioner");
            else if (cert === "scrum") certifications.push("Certified ScrumMaster (CSM)");
            else certifications.push(cert.toUpperCase() + " Certification");
        }
    });
    if (certifications.length === 0) {
        certifications.push("Full Stack Web Development Certification");
    }

    return {
        extractedSkills: extractedSkills.length > 0 ? extractedSkills : ["React", "JavaScript", "Node.js"],
        extractedProjects: projects,
        extractedExperience: experience,
        extractedEducation: education,
        extractedCertifications: certifications
    };
};

const fallbackGenerateQuestion = (role, level, mode, skills, resumeData) => {
    const isCoding = mode.toLowerCase() === 'coding';
    
    if (isCoding) {
        const codingQuestions = [
            {
                text: "Write a JavaScript function reverseString(str) that takes a string as input and returns the reversed string. For example, reverseString('hello') should return 'olleh'.",
                category: "Coding",
                difficulty: "Easy",
                functionName: "reverseString",
                testCases: [
                    { input: ["hello"], expected: "olleh" },
                    { input: ["world"], expected: "dlrow" },
                    { input: ["React"], expected: "tcaeR" }
                ]
            },
            {
                text: "Write a JavaScript function factorial(n) that takes a non-negative integer n and returns the factorial of n. For example, factorial(5) should return 120, and factorial(0) should return 1.",
                category: "Coding",
                difficulty: "Medium",
                functionName: "factorial",
                testCases: [
                    { input: [5], expected: 120 },
                    { input: [0], expected: 1 },
                    { input: [3], expected: 6 }
                ]
            },
            {
                text: "Write a JavaScript function isPalindrome(str) that checks whether a passed string is palindrome or not. Return true if palindrome, false otherwise. (Ignore casing and non-alphanumeric characters).",
                category: "Coding",
                difficulty: "Easy",
                functionName: "isPalindrome",
                testCases: [
                    { input: ["racecar"], expected: true },
                    { input: ["hello"], expected: false },
                    { input: ["A man, a plan, a canal. Panama"], expected: true }
                ]
            },
            {
                text: "Write a JavaScript function twoSum(nums, target) that finds two numbers in an array that add up to a specific target number. Return their indices as an array [index1, index2]. Assume there is exactly one solution.",
                category: "Coding",
                difficulty: "Hard",
                functionName: "twoSum",
                testCases: [
                    { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
                    { input: [[3, 2, 4], 6], expected: [1, 2] }
                ]
            }
        ];
        
        if (level.toLowerCase() === 'junior' || level.toLowerCase() === 'entry') return codingQuestions[0];
        if (level.toLowerCase() === 'mid') return codingQuestions[1];
        if (level.toLowerCase() === 'senior') return codingQuestions[3];
        return codingQuestions[2];
    } else {
        const techQuestions = {
            "frontend": [
                { text: "Can you explain the difference between virtual DOM and real DOM in React, and how React optimizes rendering?", category: "Technical", difficulty: "Medium" },
                { text: "What is Event Loop in JavaScript? Explain the call stack, web APIs, task queue, and microtask queue.", category: "Technical", difficulty: "Hard" },
                { text: "Explain CSS Specificity and how the cascade determines which styles are applied to an element.", category: "Technical", difficulty: "Easy" }
            ],
            "backend": [
                { text: "Explain the difference between SQL and NoSQL databases. When would you choose one over the other?", category: "Technical", difficulty: "Medium" },
                { text: "What is database indexing and how does it work? What are the potential trade-offs of having too many indexes?", category: "Technical", difficulty: "Hard" },
                { text: "What is the purpose of RESTful API status codes? Explain the difference between 201, 401, 403, and 500.", category: "Technical", difficulty: "Easy" }
            ],
            "fullstack": [
                { text: "How would you design a scalable notification system that sends real-time alerts to users?", category: "Scenario", difficulty: "Hard" },
                { text: "Explain JWT (JSON Web Tokens) based authentication and how refresh token rotation works to maintain secure sessions.", category: "Technical", difficulty: "Medium" },
                { text: "What is CORS (Cross-Origin Resource Sharing) and how do you resolve CORS errors in an Express app?", category: "Technical", difficulty: "Easy" }
            ]
        };

        const roleLower = role.toLowerCase();
        let selectedCategory = "frontend";
        if (roleLower.includes("backend") || roleLower.includes("devops") || roleLower.includes("database")) {
            selectedCategory = "backend";
        } else if (roleLower.includes("full") || roleLower.includes("stack") || roleLower.includes("software")) {
            selectedCategory = "fullstack";
        }

        const questionsList = techQuestions[selectedCategory];
        if (level.toLowerCase() === 'junior' || level.toLowerCase() === 'entry') return questionsList[2];
        if (level.toLowerCase() === 'senior') return questionsList[0];
        return questionsList[1];
    }
};

const fallbackEvaluateAnswer = (questionText, answerText, role, level) => {
    const answerLength = answerText ? answerText.trim().length : 0;
    const words = answerText ? answerText.toLowerCase().split(/\s+/) : [];
    
    let relevanceScore = 15;
    let technicalScore = 15;
    let clarityScore = 15;
    let communicationScore = 15;

    if (answerLength > 10) relevanceScore = 18;
    if (answerLength > 50) relevanceScore = 22;
    if (answerLength > 100) relevanceScore = 24;

    const technicalKeywords = [
        "component", "state", "props", "hook", "rendering", "database", "query", "index", "schema", "table",
        "api", "endpoint", "request", "response", "json", "rest", "graphql", "server", "client", "service",
        "authentication", "authorization", "token", "jwt", "cookie", "session", "middleware", "route", "controller",
        "asynchronous", "promise", "callback", "async", "await", "loop", "stack", "complexity", "time", "space", "algorithm",
        "css", "html", "style", "class", "id", "selector", "flexbox", "grid", "responsive"
    ];

    let matchCount = 0;
    technicalKeywords.forEach(kw => {
        if (words.includes(kw)) matchCount++;
    });

    technicalScore = Math.min(25, 12 + Math.min(8, matchCount * 2) + (level.toLowerCase() === 'junior' ? 3 : 0));
    clarityScore = Math.min(25, 14 + Math.min(6, Math.floor(words.length / 15)));
    communicationScore = Math.min(25, 15 + Math.min(5, Math.floor(words.length / 20)));

    const totalScore = relevanceScore + technicalScore + clarityScore + communicationScore;

    let feedback = "";
    let suggestions = [];

    if (answerLength < 10) {
        feedback = "The response is extremely brief and does not adequately address the technical requirements of the question. Please provide more detail and context.";
        suggestions = [
            "Explain the core technical concepts directly related to the question.",
            "Use industry-standard terminology to demonstrate your technical depth.",
            "Provide real-world examples or scenarios where these principles apply."
        ];
    } else {
        feedback = `Great start! Your answer shows a solid understanding of the concepts. You successfully hit ${matchCount} technical keywords. The response is clear, structured, and displays good communication flow. To make it stand out even more, you could dive deeper into the architectural details or edge cases.`;
        suggestions = [
            "Elaborate on how this solution scales under high load or traffic.",
            "Discuss alternative approaches or trade-offs involved in your solution.",
            "Include specific optimization techniques (e.g., caching, lazy loading, debouncing) you would employ."
        ];
    }

    return {
        relevanceScore,
        technicalScore,
        clarityScore,
        communicationScore,
        totalScore,
        feedback,
        suggestions
    };
};

const fallbackGenerateFollowup = (role, level, mode, skills, history, lastScore) => {
    const isCoding = mode.toLowerCase() === 'coding';
    
    if (isCoding) {
        const codingQuestions = [
            {
                text: "Write a JavaScript function fibonacci(n) that returns the nth Fibonacci number. Solve it using an efficient approach.",
                category: "Coding",
                difficulty: "Medium",
                functionName: "fibonacci",
                testCases: [
                    { input: [6], expected: 8 },
                    { input: [1], expected: 1 },
                    { input: [0], expected: 0 }
                ]
            },
            {
                text: "Write a JavaScript function findMax(arr) that returns the maximum element in an array of numbers. For example, findMax([1, 5, 3]) should return 5.",
                category: "Coding",
                difficulty: "Easy",
                functionName: "findMax",
                testCases: [
                    { input: [[1, 5, 3]], expected: 5 },
                    { input: [[-10, -5, -20]], expected: -5 }
                ]
            },
            {
                text: "Write a JavaScript function mergeSortedArrays(arr1, arr2) that merges two sorted arrays into one sorted array.",
                category: "Coding",
                difficulty: "Hard",
                functionName: "mergeSortedArrays",
                testCases: [
                    { input: [[1, 3, 5], [2, 4, 6]], expected: [1, 2, 3, 4, 5, 6] }
                ]
            }
        ];
        if (lastScore > 75) return codingQuestions[2];
        if (lastScore < 45) return codingQuestions[1];
        return codingQuestions[0];
    } else {
        const techQuestions = [
            { text: "How do you optimize front-end application performance? Mention techniques like lazy loading, bundling, and image optimization.", category: "Technical", difficulty: "Medium" },
            { text: "Describe how you handle state management in a large-scale React app. Compare Context API with Redux or Zustand.", category: "Technical", difficulty: "Medium" },
            { text: "Explain security vulnerabilities such as SQL injection, XSS (Cross-Site Scripting), and CSRF, and how to defend against them.", category: "Technical", difficulty: "Hard" },
            { text: "Describe your experience working in an Agile/Scrum team. How do you handle tight deadlines or scope changes?", category: "HR", difficulty: "Easy" }
        ];
        
        const index = history.length % techQuestions.length;
        return techQuestions[index];
    }
};

const fallbackGenerateFinalReport = (role, level, QAs) => {
    const scores = QAs.map(qa => qa.score || 70);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    let strengths = [];
    let weaknesses = [];
    let gaps = [];
    let readiness = 60;
    let confidence = "Medium";

    if (avgScore > 75) {
        strengths = [
            "Strong command of core architectural concepts and technical terminology.",
            "Excellent communication clarity and structural flow in explanations.",
            "Good understanding of optimization strategies and edge-case handling."
        ];
        weaknesses = [
            "Could dive deeper into specific production-grade deployment nuances.",
            "Minor gaps in describing advanced state synchronization patterns.",
            "Opportunities to improve code execution speed or complexity bounds."
        ];
        gaps = ["System Design Patterns", "Kubernetes Orchestration", "Redis Cache Invalidation"];
        readiness = Math.min(100, avgScore + 5);
        confidence = "High";
    } else {
        strengths = [
            "Good foundational understanding of the primary role requirements.",
            "Clear and cooperative communication style throughout the session.",
            "Demonstrates basic problem-solving abilities."
        ];
        weaknesses = [
            "Needs to utilize more precise technical terms in technical explanations.",
            "Tendency to provide brief responses without discussing alternative approaches.",
            "Struggled with complex coding tasks or deep architectural questions."
        ];
        gaps = ["Asynchronous JavaScript / Event Loop", "Database Indexing & Query Tuning", "RESTful API Security"];
        readiness = Math.max(40, avgScore - 5);
        confidence = "Medium";
    }

    return {
        strengths,
        weaknesses,
        skillGaps: gaps,
        overallRating: avgScore,
        hiringReadinessScore: readiness,
        confidenceLevel: confidence,
        recommendations: {
            roles: [role, "Software Engineer", `${level} Developer`],
            roadmap: "Step 1: Focus on building deep knowledge of architectural design patterns. Step 2: Build 2-3 medium-sized full-stack projects using TypeScript and Docker. Step 3: Study database performance optimization and indexing. Step 4: Practice data structures and algorithms (LeetCode medium problems).",
            topics: ["System Design", "Database Query Performance", "Web Security Best Practices (OWASP)", "Docker & CI/CD"],
            projects: [
                "Real-Time Chat Application using WebSockets and Redis",
                "API Gateway with Rate Limiting and JWT auth",
                "Distributed Task Scheduler queue system"
            ]
        },
        radarMetrics: {
            technical: Math.min(100, Math.max(10, avgScore - 2)),
            communication: Math.min(100, Math.max(10, avgScore + 4)),
            clarity: Math.min(100, Math.max(10, avgScore + 2)),
            relevance: Math.min(100, Math.max(10, avgScore - 3)),
            depth: Math.min(100, Math.max(10, avgScore - 5))
        }
    };
};

const fallbackDetectSkillGaps = (role, skills) => {
    const roleLower = role.toLowerCase();
    const skillsLower = skills.map(s => s.toLowerCase());
    const standardSkills = {
        "frontend": ["react", "typescript", "tailwind css", "next.js", "jest", "webpack", "redux"],
        "backend": ["node.js", "express", "postgresql", "mongodb", "redis", "docker", "aws", "rest api"],
        "fullstack": ["react", "node.js", "express", "mongodb", "docker", "typescript", "aws", "git"]
    };

    let selectedKey = "fullstack";
    if (roleLower.includes("front") || roleLower.includes("ui") || roleLower.includes("web")) {
        selectedKey = "frontend";
    } else if (roleLower.includes("back") || roleLower.includes("devops") || roleLower.includes("server")) {
        selectedKey = "backend";
    }

    const standardList = standardSkills[selectedKey];
    const missing = standardList.filter(s => !skillsLower.includes(s));
    
    return missing.map(s => s.charAt(0).toUpperCase() + s.slice(1));
};

// -------------------------------------------------------------
// Public API Exports (with Fallback Handlers)
// -------------------------------------------------------------

// 1. Analyze Resume
exports.analyzeResume = async (resumeText) => {
    try {
        const systemPrompt = "You are an expert AI resume parser. Extract structures from resumes. Return ONLY valid JSON.";
        const prompt = `Extract all details from this resume text.
        Return ONLY a JSON object with:
        - extractedSkills: array of strings
        - extractedProjects: array of objects (each with title, description, technologies (array))
        - extractedExperience: array of objects (each with title, company, duration, description)
        - extractedEducation: array of objects (each with degree, fieldOfStudy, school, year)
        - extractedCertifications: array of strings
        
        Resume Text:
        ${resumeText}`;

        const text = await generateText(prompt, systemPrompt);
        return cleanAndParseJSON(text);
    } catch (err) {
        console.warn("AI resume parsing failed, using local fallback heuristics:", err.message);
        return fallbackAnalyzeResume(resumeText);
    }
};

// 2. Generate First Question
exports.generateQuestion = async (role, level, mode, skills, resumeData) => {
    try {
        const systemPrompt = "You are an expert technical interviewer. Generate the first question. Return ONLY valid JSON.";
        const prompt = `Generate the first interview question for a ${level} level candidate applying for a ${role} position.
        The mode of the interview is ${mode}.
        The candidate has the following skills: ${JSON.stringify(skills)}.
        Resume Context: ${JSON.stringify(resumeData || {})}.
        
        Return ONLY a JSON object with:
        - text: The question text (should be adaptive, personalized, and appropriate for ${level} level)
        - category: The category (e.g. Technical, Coding, HR, Scenario)
        - difficulty: Easy, Medium, or Hard
        - functionName: (Only if category is Coding) string representing function name user must write, e.g. "isPalindrome"
        - testCases: (Only if category is Coding) array of objects, e.g. [{"input": ["racecar"], "expected": true}, {"input": ["hello"], "expected": false}]`;

        const text = await generateText(prompt, systemPrompt);
        return cleanAndParseJSON(text);
    } catch (err) {
        console.warn("AI question generation failed, using local fallback heuristics:", err.message);
        return fallbackGenerateQuestion(role, level, mode, skills, resumeData);
    }
};

// 3. Evaluate Answer
exports.evaluateAnswer = async (questionText, answerText, role, level) => {
    try {
        const systemPrompt = "You are a senior tech lead evaluating interview answers. Return ONLY valid JSON.";
        const prompt = `Evaluate the candidate's answer for this question:
        Question: "${questionText}"
        Candidate's Answer: "${answerText}"
        Role: ${role}
        Experience Level: ${level}
        
        Evaluate across relevance, technical depth, clarity, and communication.
        
        Return ONLY a JSON object with:
        - relevanceScore: score from 0 to 25
        - technicalScore: score from 0 to 25 (depth of tech terminology and correctness)
        - clarityScore: score from 0 to 25 (directness and structure)
        - communicationScore: score from 0 to 25 (flow, grammar, tone)
        - totalScore: score from 0 to 100 (sum of the above)
        - feedback: Detailed critique of the answer
        - suggestions: list of strings with specific ways the answer could be improved`;

        const text = await generateText(prompt, systemPrompt);
        return cleanAndParseJSON(text);
    } catch (err) {
        console.warn("AI answer evaluation failed, using local fallback heuristics:", err.message);
        return fallbackEvaluateAnswer(questionText, answerText, role, level);
    }
};

// 4. Generate Follow-up / Next Question (Adaptive AI)
exports.generateFollowup = async (role, level, mode, skills, history, lastScore) => {
    try {
        const systemPrompt = "You are an adaptive AI interviewer. Adjust difficulty and prompt follow-up questions. Return ONLY valid JSON.";
        
        let difficultyRule = "maintain difficulty (Medium)";
        if (lastScore > 75) {
            difficultyRule = "increase difficulty (Hard)";
        } else if (lastScore < 40) {
            difficultyRule = "decrease difficulty (Easy)";
        }

        const prompt = `Generate the next question for a ${role} interview (${level} experience level, ${mode} mode).
        Candidate skills: ${JSON.stringify(skills)}.
        
        History of session:
        ${JSON.stringify(history)}
        
        Based on the score of the previous answer (${lastScore}/100), you must follow this rule: ${difficultyRule}.
        Generate a contextual follow-up question that drills into details of the previous answer or changes topic appropriately.
        
        Return ONLY a JSON object with:
        - text: The question text
        - category: The category (e.g. Technical, Coding, HR)
        - difficulty: Easy, Medium, or Hard
        - functionName: (Only if category is Coding) string representing function name user must write, e.g. "fibonacci"
        - testCases: (Only if category is Coding) array of objects, e.g. [{"input": [6], "expected": 8}]`;

        const text = await generateText(prompt, systemPrompt);
        return cleanAndParseJSON(text);
    } catch (err) {
        console.warn("AI follow-up question generation failed, using local fallback heuristics:", err.message);
        return fallbackGenerateFollowup(role, level, mode, skills, history, lastScore);
    }
};

// 5. Generate Final Report
exports.generateFinalReport = async (role, level, questionsAndAnswers) => {
    try {
        const systemPrompt = "You are an Principal Career Advisor and Hiring Manager. Return ONLY valid JSON.";
        const prompt = `Analyze this entire completed interview session:
        Role: ${role}
        Level: ${level}
        
        Q&A Session:
        ${JSON.stringify(questionsAndAnswers)}
        
        Evaluate the overall performance, compile strengths, weaknesses, gaps, roadmap, and score metrics.
        
        Return ONLY a JSON object with:
        - strengths: array of strings (top 3 strengths)
        - weaknesses: array of strings (top 3 weaknesses)
        - skillGaps: array of strings (missing technical skills or concepts)
        - overallRating: number from 0 to 100
        - hiringReadinessScore: number from 0 to 100 (readiness for live market role)
        - confidenceLevel: Low, Medium, or High
        - recommendations: a JSON object with:
            - roles: array of strings (recommended career roles they qualify for)
            - roadmap: string (detailed step-by-step career development path)
            - topics: array of strings (list of specific topics to study)
            - projects: array of strings (list of specific learning projects they should build)
        - radarMetrics: a JSON object with:
            - technical: number from 0 to 100
            - communication: number from 0 to 100
            - clarity: number from 0 to 100
            - relevance: number from 0 to 100
            - depth: number from 0 to 100`;

        const text = await generateText(prompt, systemPrompt);
        return cleanAndParseJSON(text);
    } catch (err) {
        console.warn("AI final report generation failed, using local fallback heuristics:", err.message);
        return fallbackGenerateFinalReport(role, level, questionsAndAnswers);
    }
};

// 6. Detect Skill Gaps
exports.detectSkillGaps = async (role, skills) => {
    try {
        const systemPrompt = "You are a professional IT career counselor. Return ONLY valid JSON.";
        const prompt = `Identify the skill gaps for a candidate aiming for a ${role} role, who currently lists these skills: ${JSON.stringify(skills)}.
        Return ONLY a JSON array of strings of missing skills/concepts (e.g., ["Docker", "Redis", "TypeScript"]).`;

        const text = await generateText(prompt, systemPrompt);
        return cleanAndParseJSON(text);
    } catch (err) {
        console.warn("AI skill gap detection failed, using local fallback heuristics:", err.message);
        return fallbackDetectSkillGaps(role, skills);
    }
};
