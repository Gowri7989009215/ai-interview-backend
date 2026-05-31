// MongoDB Setup Script for ProInterview AI
// Paste this code into your MongoDB Compass Shell (mongosh)

// 1. Switch to the database
// use prointerview - ai;

// 2. Create Users collection and indices
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });

// 3. Insert a sample user (password is 'password123' - but the server hashes it)
// Note: In a real scenario, the salt/hash would be done by the server. 
// This is just to initialize the collection structure.
db.users.insertOne({
    username: "testuser",
    email: "test@example.com",
    password: "$2a$10$7R8y9y9y9y9y9y9y9y9y9u6N8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y8Y", // Mocked hash
    role: "user",
    createdAt: new Date()
});

// 4. Create Interviews collection and indices
db.interviews.createIndex({ "user": 1 });

// 5. Insert a sample interview
db.interviews.insertOne({
    user: db.users.findOne({ username: "testuser" })._id,
    role: "Software Engineer",
    experienceLevel: "Junior",
    mode: "Technical",
    questions: [
        {
            questionText: "What is your experience with React?",
            answerText: "I have used React for 2 years in various projects.",
            aiFeedback: "Good answer, but could be more specific about hooks.",
            score: 8,
            category: "Technical",
            isFollowUp: false
        }
    ],
    overallScore: 8,
    skillScores: {
        technical: 8,
        communication: 9,
        clarity: 8
    },
    status: "completed",
    createdAt: new Date()
});

print("Database 'prointerview-ai' setup complete with sample data!");
