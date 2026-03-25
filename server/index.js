import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
dotenv.config();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] } });
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/messenger-ai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Mock data storage (replace with MongoDB)
const chats = new Map();
const users = new Map();
const groups = new Map();
const sessions = new Map();

// Session management
app.post('/api/session', (req, res) => {
    const sessionId = uuidv4();
    const userId = uuidv4();
    const user = { id: userId, name: `User ${userId.substring(0, 8)}`, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`, status: 'online', createdAt: new Date() }; 
    users.set(userId, user);
    sessions.set(sessionId, userId);
    res.json({ sessionId, user });
});

// Get user profile
app.get('/api/user/:sessionId', (req, res) => {
    const userId = sessions.get(req.params.sessionId);
    if (!userId) return res.status(401).json({ error: 'Session not found' });
    res.json(users.get(userId));
});

// Socket.io events
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('join-chat', (data) => {
        const { chatId, userId } = data;
        socket.join(`chat-${chatId}`);
        console.log(`User ${userId} joined chat ${chatId}`);
    });
    socket.on('send-message', (data) => {
        const { chatId, userId, message, timestamp } = data;
        const msg = { id: uuidv4(), userId, message, timestamp: timestamp || new Date(), type: 'text' };
        if (!chats.has(chatId)) {
            chats.set(chatId, []);
        }
        chats.get(chatId).push(msg);
        io.to(`chat-${chatId}`).emit('message-received', msg);
    });
    socket.on('typing', (data) => {
        const { chatId, userId } = data;
        io.to(`chat-${chatId}`).emit('user-typing', { userId });
    });
    socket.on('stop-typing', (data) => {
        const { chatId, userId } = data;
        io.to(`chat-${chatId}`).emit('user-stop-typing', { userId });
    });
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// MongoDB connection (optional)
if (process.env.USE_MONGODB === 'true') {
    mongoose.connect(MONGODB_URI).then(() => {
        console.log('MongoDB connected');
    }).catch(err => console.log('MongoDB error:', err));
}

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
