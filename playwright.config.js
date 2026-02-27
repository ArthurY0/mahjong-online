// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * Playwright E2E Test Configuration for Mahjong Online
 *
 * Tests use socket.io-client directly against the running server
 * to simulate 4 concurrent players without requiring UI interaction.
 * The server is started programmatically by the global setup script.
 */
module.exports = defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.js',

    // Each test file gets its own timeout budget
    timeout: 60000,

    // Retry flaky tests once in CI, no retries locally
    retries: process.env.CI ? 1 : 0,

    // Run test files in parallel but keep tests within a file sequential
    // (game state is stateful; order matters inside a suite)
    fullyParallel: false,
    workers: 1,

    reporter: [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['junit', { outputFile: 'playwright-report/junit.xml' }],
        ['list']
    ],

    use: {
        // Base URL for browser-based tests (if any are added later)
        baseURL: 'http://localhost:3000',

        // Capture artifacts on failure
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'on-first-retry',

        // Reasonable action / navigation timeouts
        actionTimeout: 15000,
        navigationTimeout: 15000
    },

    // Start / stop the game server around the entire test run
    globalSetup: './tests/e2e/helpers/global-setup.js',
    globalTeardown: './tests/e2e/helpers/global-teardown.js',

    projects: [
        {
            name: 'socket-api',
            // Socket API tests do not need a real browser
            testMatch: '**/game-actions.spec.js'
        }
    ]
});
