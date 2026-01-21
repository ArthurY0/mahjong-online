const express = require('express');
const bodyParser = require('body-parser');
const DatabaseManager = require('./database/Database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const dbManager = new DatabaseManager();

// Middleware to check if the database is ready
app.use(async (req, res, next) => {
    await dbManager.ready;
    next();
});

// Define routes
app.get('/', (req, res) => {
    res.send('Welcome to the Mahjong Online Game API');
});

// Example route to create a user
app.post('/users', async (req, res) => {
    const { username, passwordHash } = req.body;
    const result = await dbManager.createUser(username, passwordHash);
    if (result.success) {
        res.status(201).json({ userId: result.userId });
    } else {
        res.status(400).json({ error: result.error });
    }
});

// Example route to get user stats
app.get('/users/:id/stats', async (req, res) => {
    const userId = req.params.id;
    const stats = await dbManager.getUserStats(userId);
    if (stats) {
        res.json(stats);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});