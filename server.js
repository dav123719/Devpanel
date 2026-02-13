const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Kimi API Configuration
const KIMI_BASE_URL = 'https://api.moonshot.cn/v1';
const DEFAULT_MODEL = 'kimi-k2-turbo-preview';

// Store API keys per session (in production, use Redis or database)
const sessionKeys = new Map();

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Set API key for session
app.post('/api/set-key', (req, res) => {
    const { sessionId, apiKey } = req.body;
    if (!sessionId || !apiKey) {
        return res.status(400).json({ error: 'Session ID and API key required' });
    }
    sessionKeys.set(sessionId, apiKey);
    res.json({ success: true, message: 'API key set' });
});

// Get available models
app.get('/api/models', async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const apiKey = sessionKeys.get(sessionId) || process.env.MOONSHOT_API_KEY;
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API key not configured' });
    }

    try {
        const response = await fetch(`${KIMI_BASE_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Chat completion endpoint (non-streaming)
app.post('/api/chat', async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const apiKey = sessionKeys.get(sessionId) || process.env.MOONSHOT_API_KEY;
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API key not configured. Please set your Moonshot API key first.' });
    }

    const { messages, model = DEFAULT_MODEL, temperature = 0.6 } = req.body;

    try {
        const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                stream: false
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    const apiKey = sessionKeys.get(sessionId) || process.env.MOONSHOT_API_KEY;
    
    if (!apiKey) {
        return res.status(401).json({ error: 'API key not configured' });
    }

    const { messages, model = DEFAULT_MODEL, temperature = 0.6 } = req.body;

    try {
        const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json(error);
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        response.body.pipe(res);
        
        response.body.on('error', (err) => {
            console.error('Stream error:', err);
            res.end();
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get conversation history (stored in memory)
const conversations = new Map();

app.get('/api/conversations/:id', (req, res) => {
    const conv = conversations.get(req.params.id);
    res.json(conv || { messages: [] });
});

app.post('/api/conversations/:id', (req, res) => {
    const { messages } = req.body;
    conversations.set(req.params.id, { messages, updatedAt: new Date() });
    res.json({ success: true });
});

// List all conversations
app.get('/api/conversations', (req, res) => {
    const list = Array.from(conversations.entries()).map(([id, data]) => ({
        id,
        updatedAt: data.updatedAt,
        messageCount: data.messages?.length || 0
    }));
    res.json(list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 DevPanel server running on port ${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
});
