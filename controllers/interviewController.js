const Interview = require('../models/Interview');
const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Report = require('../models/Report');
const claudeService = require('../services/claudeService');
const runSandbox = require('../utils/sandbox');

// 1. Start Interview
exports.startInterview = async (req, res) => {
    try {
        const { role, experienceLevel, mode } = req.body;
        const level = experienceLevel || 'Mid';

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Retrieve skills from resumeData if available, otherwise empty list
        const skills = user.resumeData?.skills || [];
        const resumeContext = user.resumeData || {};

        // Generate first question using Claude
        const aiQuestion = await claudeService.generateQuestion(role, level, mode, skills, resumeContext);

        const newInterview = new Interview({
            user: req.user.id,
            userId: req.user.id,
            role,
            level,
            experienceLevel: level,
            mode,
            questions: [
                {
                    questionText: aiQuestion.text,
                    answerText: '',
                    aiFeedback: '',
                    score: 0,
                    category: aiQuestion.category || 'Technical',
                    isFollowUp: false
                }
            ],
            status: 'in-progress',
            startTime: new Date(),
            suspiciousEvents: 0
        });

        await newInterview.save();

        // Save Question model record
        const questionRecord = new Question({
            interviewId: newInterview._id,
            text: aiQuestion.text,
            difficulty: aiQuestion.difficulty || 'Medium',
            category: aiQuestion.category || 'Technical',
            aiGenerated: true
        });
        await questionRecord.save();

        res.status(201).json(newInterview);
    } catch (err) {
        console.error("Error in startInterview:", err);
        res.status(500).json({ message: 'Server error starting session', error: err.message });
    }
};

// 2. Submit Answer (Adaptive Flow & Sandboxed Coding Checks)
exports.submitAnswer = async (req, res) => {
    try {
        const { interviewId, questionIndex, answerText, duration, suspiciousEvents } = req.body;

        const interview = await Interview.findById(interviewId);
        if (!interview) return res.status(404).json({ message: 'Interview not found' });

        if (interview.status === 'completed') {
            return res.status(400).json({ message: 'This interview session has already been completed.' });
        }

        // Update anti-cheat counter if reported
        if (suspiciousEvents) {
            interview.suspiciousEvents = (interview.suspiciousEvents || 0) + suspiciousEvents;
        }

        const currentQuestion = interview.questions[questionIndex];
        if (!currentQuestion) {
            return res.status(400).json({ message: 'Invalid question index.' });
        }

        // Retrieve/Create associated Question record
        let questionRecord = await Question.findOne({ interviewId, text: currentQuestion.questionText });
        if (!questionRecord) {
            questionRecord = new Question({
                interviewId,
                text: currentQuestion.questionText,
                difficulty: 'Medium',
                category: currentQuestion.category || 'Technical',
                aiGenerated: true
            });
            await questionRecord.save();
        }

        let evaluation = {};
        const isCodingQuestion = currentQuestion.category === 'Coding' || interview.mode === 'Coding';

        if (isCodingQuestion) {
            // Evaluated inside Javascript VM Sandbox!
            // Retrieve test cases from LLM or generate defaults
            let testCases = [];
            if (questionRecord.testCases && questionRecord.testCases.length > 0) {
                testCases = questionRecord.testCases;
            } else {
                // Parse dynamic test cases from Claude if available or construct basic assertion
                try {
                    // Try to guess function name from question text or fallback
                    const guessedFuncName = currentQuestion.questionText.includes('factorial') ? 'factorial' : 
                                            currentQuestion.questionText.includes('reverseString') ? 'reverseString' : 'solution';
                    const mockInputs = currentQuestion.questionText.includes('factorial') ? [[5], [0]] : 
                                       currentQuestion.questionText.includes('reverseString') ? [["hello"], ["world"]] : [[]];
                    const mockOutputs = currentQuestion.questionText.includes('factorial') ? [120, 1] : 
                                        currentQuestion.questionText.includes('reverseString') ? ["olleh", "dlrow"] : [true];
                    
                    testCases = mockInputs.map((input, idx) => ({
                        input,
                        expected: mockOutputs[idx],
                        functionName: guessedFuncName
                    }));
                } catch (tcErr) {
                    testCases = [{ input: [], expected: true, functionName: 'solution' }];
                }
            }

            const sandboxResult = runSandbox(answerText, testCases);
            const passedPercent = sandboxResult.totalCount > 0 ? (sandboxResult.passedCount / sandboxResult.totalCount) * 100 : 100;
            
            // Build detailed feedback prompt for Claude to perform complexity & correctness evaluation
            const codeReport = await claudeService.evaluateAnswer(
                currentQuestion.questionText,
                `User submitted code: \n${answerText}\n\nSandbox Execution Results: ${JSON.stringify(sandboxResult)}`,
                interview.role,
                interview.level
            );

            evaluation = {
                relevanceScore: Math.round(passedPercent * 0.25),
                technicalScore: Math.round(codeReport.technicalScore || (passedPercent * 0.25)),
                clarityScore: Math.round(codeReport.clarityScore || 20),
                communicationScore: Math.round(codeReport.communicationScore || 20),
                totalScore: Math.round(passedPercent * 0.5 + (codeReport.totalScore || 80) * 0.5),
                feedback: `${codeReport.feedback || 'Sandbox executed.'} Code verification tests passed: ${sandboxResult.passedCount}/${sandboxResult.totalCount}.`,
                suggestions: codeReport.suggestions || []
            };
        } else {
            // General text / voice evaluation
            evaluation = await claudeService.evaluateAnswer(
                currentQuestion.questionText,
                answerText,
                interview.role,
                interview.level
            );
        }

        // Save Answer model record
        const answerRecord = new Answer({
            questionId: questionRecord._id,
            interviewId,
            answer: answerText,
            duration: duration || 0,
            relevanceScore: evaluation.relevanceScore || 0,
            technicalScore: evaluation.technicalScore || 0,
            clarityScore: evaluation.clarityScore || 0,
            communicationScore: evaluation.communicationScore || 0,
            totalScore: evaluation.totalScore || 0,
            feedback: evaluation.feedback
        });
        await answerRecord.save();

        // Update embedded questions array inside Interview
        interview.questions[questionIndex].answerText = answerText;
        interview.questions[questionIndex].aiFeedback = evaluation.feedback;
        interview.questions[questionIndex].score = evaluation.totalScore || 0;

        // Determine if we need to generate next question or complete session
        const nextIndex = questionIndex + 1;
        const totalQuestionsRequired = 5; // Platform default questions length

        if (nextIndex < totalQuestionsRequired) {
            // Adaptive AI: Generate next question based on performance score
            const user = await User.findById(interview.user);
            const skills = user?.resumeData?.skills || [];
            
            // Map past Q&As for context
            const history = interview.questions
                .filter((q, idx) => idx <= questionIndex)
                .map(q => ({
                    question: q.questionText,
                    answer: q.answerText,
                    score: q.score
                }));

            const nextAiQuestion = await claudeService.generateFollowup(
                interview.role,
                interview.level,
                interview.mode,
                skills,
                history,
                evaluation.totalScore || 50
            );

            interview.questions.push({
                questionText: nextAiQuestion.text,
                answerText: '',
                aiFeedback: '',
                score: 0,
                category: nextAiQuestion.category || 'Technical',
                isFollowUp: true
            });

            // Save new Question record
            const newQuestionRecord = new Question({
                interviewId,
                text: nextAiQuestion.text,
                difficulty: nextAiQuestion.difficulty || 'Medium',
                category: nextAiQuestion.category || 'Technical',
                aiGenerated: true
            });
            await newQuestionRecord.save();

            await interview.save();
            res.json({ completed: false, nextIndex, interview });
        } else {
            // Session complete! Run final compiler report
            interview.status = 'completed';
            interview.endTime = new Date();

            const questionsAnswers = interview.questions.map(q => ({
                question: q.questionText,
                answer: q.answerText,
                score: q.score
            }));

            // Calculate overall score (average of question scores)
            const sumScores = interview.questions.reduce((sum, q) => sum + (q.score || 0), 0);
            const finalScore = Math.round(sumScores / totalQuestionsRequired);
            
            interview.overallScore = finalScore;
            interview.finalScore = finalScore;

            // Generate report content using Claude/Gemini
            const finalReportContent = await claudeService.generateFinalReport(
                interview.role,
                interview.level,
                questionsAnswers
            );

            // Populate skill scores in Interview model
            interview.skillScores = {
                technical: finalReportContent.radarMetrics?.technical || finalScore,
                communication: finalReportContent.radarMetrics?.communication || finalScore,
                clarity: finalReportContent.radarMetrics?.clarity || finalScore,
                relevance: finalReportContent.radarMetrics?.relevance || finalScore,
                depth: finalReportContent.radarMetrics?.depth || finalScore
            };

            await interview.save();

            // Save detailed Report record
            const reportRecord = new Report({
                interviewId,
                strengths: finalReportContent.strengths || [],
                weaknesses: finalReportContent.weaknesses || [],
                skillGaps: finalReportContent.skillGaps || [],
                recommendations: {
                    roles: finalReportContent.recommendations?.roles || [interview.role],
                    roadmap: finalReportContent.recommendations?.roadmap || '',
                    topics: finalReportContent.recommendations?.topics || [],
                    projects: finalReportContent.recommendations?.projects || [],
                },
                radarMetrics: {
                    technical: finalReportContent.radarMetrics?.technical || finalScore,
                    communication: finalReportContent.radarMetrics?.communication || finalScore,
                    clarity: finalReportContent.radarMetrics?.clarity || finalScore,
                    relevance: finalReportContent.radarMetrics?.relevance || finalScore,
                    depth: finalReportContent.radarMetrics?.depth || finalScore
                },
                overallRating: finalScore,
                hiringReadinessScore: finalReportContent.hiringReadinessScore || finalScore,
                confidenceLevel: finalReportContent.confidenceLevel || 'Medium'
            });
            await reportRecord.save();

            // Update user stats
            const user = await User.findById(interview.user);
            if (user) {
                const totalTaken = (user.interviewsTaken || 0) + 1;
                const prevAvg = user.averageScore || 0;
                const newAvg = Math.round(((prevAvg * (totalTaken - 1)) + finalScore) / totalTaken);
                
                user.interviewsTaken = totalTaken;
                user.averageScore = newAvg;
                await user.save();
            }

            res.json({ completed: true, report: reportRecord, interview });
        }
    } catch (err) {
        console.error("Error in submitAnswer:", err);
        res.status(500).json({ message: 'Server error submitting answer', error: err.message });
    }
};

// 3. Get Interview details
exports.getInterviewById = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);
        if (!interview) return res.status(404).json({ message: 'Interview not found' });
        res.json(interview);
    } catch (err) {
        res.status(500).json({ message: 'Server error retrieving interview', error: err.message });
    }
};

// 4. Get Report details
exports.getReport = async (req, res) => {
    try {
        const report = await Report.findOne({ interviewId: req.params.id });
        if (!report) {
            // Fallback backward compatibility: check if we can reconstruct summary from Interview
            const interview = await Interview.findById(req.params.id);
            if (!interview) return res.status(404).json({ message: 'Report not found' });
            
            return res.json({
                overallScore: interview.overallScore,
                skillScores: {
                    technical: interview.skillScores?.technical || 50,
                    communication: interview.skillScores?.communication || 50,
                    clarity: interview.skillScores?.clarity || 50,
                    relevance: interview.skillScores?.relevance || 50,
                    depth: interview.skillScores?.depth || 50,
                },
                summary: {
                    strengths: ['Analytical Skills', 'Clear expression'],
                    weaknesses: ['Specific tech stack depth']
                },
                recommendations: {
                    roles: [interview.role],
                    roadmap: 'Continue practicing coding challenges.'
                },
                role: interview.role
            });
        }
        res.json({
            ...report.toObject(),
            role: (await Interview.findById(req.params.id))?.role || 'Developer'
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error retrieving report', error: err.message });
    }
};

// 5. Run tests for Monaco Editor (sandbox check only)
exports.runTests = async (req, res) => {
    try {
        const { interviewId, questionIndex, answerText } = req.body;
        const interview = await Interview.findById(interviewId);
        if (!interview) return res.status(404).json({ message: 'Interview not found' });
        
        const currentQuestion = interview.questions[questionIndex];
        const questionRecord = await Question.findOne({ interviewId, text: currentQuestion?.questionText });
        
        let testCases = [];
        if (questionRecord && questionRecord.testCases && questionRecord.testCases.length > 0) {
            testCases = questionRecord.testCases;
        } else {
            testCases = [{ input: [], expected: true, functionName: 'solution' }];
        }
        
        const result = runSandbox(answerText, testCases);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Code runner failed', error: err.message });
    }
};

// 6. Get User Interview History
exports.getHistory = async (req, res) => {
    try {
        const interviews = await Interview.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(interviews);
    } catch (err) {
        res.status(500).json({ message: 'Server error retrieving history', error: err.message });
    }
};
