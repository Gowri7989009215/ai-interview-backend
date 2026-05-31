const vm = require('vm');

/**
 * Executes user submitted JS code inside a secure VM context against test cases
 * @param {string} code - The user's JavaScript code
 * @param {Array} testCases - Array of test case objects e.g., [{ input: [5], expected: 120, functionName: 'factorial' }]
 */
const runSandbox = (code, testCases) => {
    if (!testCases || testCases.length === 0) {
        // Default test case if none provided
        testCases = [
            { input: [], expected: true, functionName: 'test' }
        ];
    }

    const results = [];
    let passedCount = 0;

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        
        // Define simple sandbox environment
        const sandbox = {
            console: {
                log: () => {} // Silence logging to avoid output buffer clutter
            }
        };

        const context = vm.createContext(sandbox);

        try {
            // Append invocation script
            const runScript = `
                ${code}
                
                // Call the function
                const result = ${tc.functionName}(...${JSON.stringify(tc.input || [])});
                result;
            `;

            // Compile and run script with a strict 1-second timeout (prevents infinite loops)
            const script = new vm.Script(runScript, { timeout: 1000 });
            const output = script.runInContext(context);

            const passed = JSON.stringify(output) === JSON.stringify(tc.expected);
            if (passed) passedCount++;

            results.push({
                testCaseIndex: i,
                input: tc.input,
                expected: tc.expected,
                actual: output,
                passed
            });
        } catch (err) {
            results.push({
                testCaseIndex: i,
                input: tc.input,
                expected: tc.expected,
                error: err.message,
                passed: false
            });
        }
    }

    return {
        passed: passedCount === testCases.length,
        passedCount,
        totalCount: testCases.length,
        results
    };
};

module.exports = runSandbox;
