/* ========== QUIKCHAT GLOBAL V2 - SERVER.JS ========== */
/* Version: 2.0.0 | Date: 2024 */
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Database (using JSON file for simplicity, in production use MongoDB/PostgreSQL)
const { JSONDatabase } = require('./database');

// ========== SERVER CONFIGURATION ==========
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ========== DATABASE INITIALIZATION ==========
const db = new JSONDatabase();

// ========== SOCKET.IO CONNECTION HANDLING ==========
const onlineUsers = new Map(); // socket.id -> user data
const userSockets = new Map(); // user.id -> socket.id
const activeCalls = new Map(); // callId -> call data
const activeChats = new Map(); // chatId -> chat data
const userRooms = new Map(); // user.id -> roomId

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // ========== USER MANAGEMENT ==========
    socket.on('register', async (userData) => {
        try {
            console.log(`Registering user: ${userData.username}`);
            
            // Validate user data
            if (!userData.username || !userData.id) {
                socket.emit('error', { message: 'Invalid user data' });
                return;
            }
            
            // Check if username exists
            const existingUser = await db.getUserByUsername(userData.username);
            if (existingUser && existingUser.id !== userData.id) {
                socket.emit('error', { message: 'Username already taken' });
                return;
            }
            
            // Save/update user
            const user = await db.saveUser({
                ...userData,
                socketId: socket.id,
                isOnline: true,
                lastSeen: new Date().toISOString(),
                connectionTime: new Date().toISOString()
            });
            
            // Store in memory maps
            onlineUsers.set(socket.id, user);
            userSockets.set(user.id, socket.id);
            
            // Join user to their personal room
            socket.join(`user:${user.id}`);
            
            // Join user to country room
            if (user.country) {
                socket.join(`country:${user.country}`);
            }
            
            // Join user to gender room
            if (user.gender) {
                socket.join(`gender:${user.gender}`);
            }
            
            // Broadcast user online status
            socket.broadcast.emit('user:online', { user: user });
            
            // Send current online users to the new user
            const onlineUsersList = Array.from(onlineUsers.values())
                .filter(u => u.id !== user.id)
                .map(u => ({
                    id: u.id,
                    username: u.username,
                    age: u.age,
                    gender: u.gender,
                    country: u.country,
                    isPremium: u.isPremium,
                    avatar: u.avatar,
                    lastSeen: u.lastSeen
                }));
            
            socket.emit('users:list', { users: onlineUsersList });
            
            // Send user their data
            socket.emit('user:registered', { user: user });
            
            // Update global stats
            updateGlobalStats();
            
            console.log(`User registered: ${user.username} (${user.id})`);
        } catch (error) {
            console.error('Registration error:', error);
            socket.emit('error', { message: 'Registration failed' });
        }
    });
    
    socket.on('user:update', async (data) => {
        try {
            const user = onlineUsers.get(socket.id);
            if (!user) return;
            
            const updatedUser = await db.updateUser(user.id, data);
            onlineUsers.set(socket.id, updatedUser);
            
            // Broadcast update to all connected clients
            socket.broadcast.emit('user:updated', { user: updatedUser });
            socket.emit('user:updated', { user: updatedUser });
        } catch (error) {
            console.error('User update error:', error);
        }
    });
    
    socket.on('user:typing', (data) => {
        const { to, isTyping } = data;
        const receiverSocketId = userSockets.get(to);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('chat:typing', {
                from: onlineUsers.get(socket.id)?.id,
                isTyping: isTyping
            });
        }
    });
    
    // ========== CHAT MANAGEMENT ==========
    socket.on('chat:find-partner', async (data) => {
        try {
            const currentUser = onlineUsers.get(socket.id);
            if (!currentUser) return;
            
            const { preferences, country } = data;
            
            // Find compatible partner
            const partner = await findCompatiblePartner(currentUser, preferences, country);
            
            if (partner) {
                // Create chat session
                const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const chatData = {
                    id: chatId,
                    user1: currentUser.id,
                    user2: partner.id,
                    type: 'text',
                    startedAt: new Date().toISOString(),
                    messages: []
                };
                
                activeChats.set(chatId, chatData);
                
                // Notify both users
                const partnerSocketId = userSockets.get(partner.id);
                
                socket.emit('chat:start', {
                    partner: partner,
                    type: 'text',
                    chatId: chatId
                });
                
                if (partnerSocketId) {
                    io.to(partnerSocketId).emit('chat:start', {
                        partner: currentUser,
                        type: 'text',
                        chatId: chatId
                    });
                }
                
                console.log(`Chat started: ${currentUser.username} <-> ${partner.username}`);
            } else {
                socket.emit('chat:no-partner', { message: 'No suitable partner found' });
            }
        } catch (error) {
            console.error('Find partner error:', error);
            socket.emit('error', { message: 'Failed to find partner' });
        }
    });
    
    socket.on('chat:request', (data) => {
        const { to, type } = data;
        const sender = onlineUsers.get(socket.id);
        const receiverSocketId = userSockets.get(to);
        
        if (!sender || !receiverSocketId) return;
        
        io.to(receiverSocketId).emit('chat:request', {
            from: sender.id,
            user: sender,
            type: type || 'text'
        });
    });
    
    socket.on('chat:message', (data) => {
        const { to, message } = data;
        const sender = onlineUsers.get(socket.id);
        const receiverSocketId = userSockets.get(to);
        
        if (!sender || !receiverSocketId) return;
        
        // Save message to database
        db.saveMessage({
            ...message,
            chatId: message.chatId || `chat_${sender.id}_${to}`,
            delivered: true,
            deliveredAt: new Date().toISOString()
        }).catch(console.error);
        
        // Forward message to receiver
        io.to(receiverSocketId).emit('chat:message', {
            from: sender.id,
            message: message
        });
        
        // Send delivery confirmation
        socket.emit('message:delivered', {
            messageId: message.id,
            deliveredAt: new Date().toISOString()
        });
    });
    
    socket.on('chat:file', (data) => {
        const { to, message } = data;
        const sender = onlineUsers.get(socket.id);
        const receiverSocketId = userSockets.get(to);
        
        if (!sender || !receiverSocketId) return;
        
        // Save file message to database
        db.saveMessage({
            ...message,
            chatId: message.chatId || `chat_${sender.id}_${to}`,
            type: 'file',
            delivered: true,
            deliveredAt: new Date().toISOString()
        }).catch(console.error);
        
        // Forward file message
        io.to(receiverSocketId).emit('chat:file', {
            from: sender.id,
            message: message
        });
    });
    
    socket.on('chat:end', (data) => {
        const { to, reason } = data;
        const sender = onlineUsers.get(socket.id);
        const receiverSocketId = userSockets.get(to);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('chat:end', {
                from: sender?.id,
                reason: reason || 'Partner ended the chat'
            });
        }
        
        // Clean up chat session
        activeChats.forEach((chat, chatId) => {
            if ((chat.user1 === sender?.id && chat.user2 === to) || 
                (chat.user2 === sender?.id && chat.user1 === to)) {
                activeChats.delete(chatId);
            }
        });
    });
    
    // ========== VIDEO/AUDIO CALL MANAGEMENT ==========
    socket.on('call:request', (data) => {
        const { to, offer, user } = data;
        const sender = onlineUsers.get(socket.id);
        const receiverSocketId = userSockets.get(to);
        
        if (!sender || !receiverSocketId) return;
        
        // Create call session
        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const callData = {
            id: callId,
            caller: sender.id,
            callee: to,
            offer: offer,
            status: 'ringing',
            startedAt: new Date().toISOString()
        };
        
        activeCalls.set(callId, callData);
        
        // Send call request
        io.to(receiverSocketId).emit('call:request', {
            from: sender.id,
            offer: offer,
            user: sender,
            callId: callId
        });
        
        // Set timeout for unanswered call (30 seconds)
        setTimeout(() => {
            const call = activeCalls.get(callId);
            if (call && call.status === 'ringing') {
                activeCalls.delete(callId);
                
                // Notify caller
                socket.emit('call:timeout', { callId: callId });
                
                // Notify callee if still connected
                if (userSockets.get(to)) {
                    io.to(userSockets.get(to)).emit('call:timeout', { callId: callId });
                }
            }
        }, 30000);
    });
    
    socket.on('call:accept', (data) => {
        const { to, answer, callId } = data;
        const accepter = onlineUsers.get(socket.id);
        const callerSocketId = userSockets.get(to);
        
        if (!accepter || !callerSocketId) return;
        
        const call = activeCalls.get(callId);
        if (!call) return;
        
        // Update call status
        call.status = 'accepted';
        call.answer = answer;
        call.acceptedAt = new Date().toISOString();
        
        // Send acceptance to caller
        io.to(callerSocketId).emit('call:accept', {
            from: accepter.id,
            answer: answer,
            callId: callId
        });
        
        // Create a room for the call
        const roomId = `call:${callId}`;
        socket.join(roomId);
        io.to(callerSocketId).join(roomId);
        
        userRooms.set(accepter.id, roomId);
        userRooms.set(to, roomId);
        
        console.log(`Call accepted: ${callId}`);
    });
    
    socket.on('call:reject', (data) => {
        const { to, reason } = data;
        const rejecter = onlineUsers.get(socket.id);
        const callerSocketId = userSockets.get(to);
        
        if (callerSocketId) {
            io.to(callerSocketId).emit('call:reject', {
                from: rejecter?.id,
                reason: reason || 'Call rejected'
            });
        }
        
        // Clean up call
        activeCalls.forEach((call, callId) => {
            if (call.caller === to && call.callee === rejecter?.id) {
                activeCalls.delete(callId);
            }
        });
    });
    
    socket.on('call:offer', (data) => {
        const { to, offer } = data;
        const receiverSocketId = userSockets.get(to);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call:offer', {
                from: onlineUsers.get(socket.id)?.id,
                offer: offer
            });
        }
    });
    
    socket.on('call:answer', (data) => {
        const { to, answer } = data;
        const receiverSocketId = userSockets.get(to);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call:answer', {
                from: onlineUsers.get(socket.id)?.id,
                answer: answer
            });
        }
    });
    
    socket.on('call:ice-candidate', (data) => {
        const { to, candidate } = data;
        const receiverSocketId = userSockets.get(to);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call:ice-candidate', {
                from: onlineUsers.get(socket.id)?.id,
                candidate: candidate
            });
        }
    });
    
    socket.on('call:end', (data) => {
        const { to, reason } = data;
        const sender = onlineUsers.get(socket.id);
        const receiverSocketId = userSockets.get(to);
        
        // Notify receiver
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call:end', {
                from: sender?.id,
                reason: reason || 'Call ended'
            });
        }
        
        // Clean up call
        activeCalls.forEach((call, callId) => {
            if ((call.caller === sender?.id && call.callee === to) || 
                (call.callee === sender?.id && call.caller === to)) {
                activeCalls.delete(callId);
                
                // Leave call room
                const roomId = `call:${callId}`;
                if (sender) {
                    socket.leave(roomId);
                    userRooms.delete(sender.id);
                }
                if (receiverSocketId) {
                    io.to(receiverSocketId).leave(roomId);
                    userRooms.delete(to);
                }
            }
        });
    });
    
    socket.on('call:video-toggle', (data) => {
        const { to, enabled } = data;
        const receiverSocketId = userSockets.get(to);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call:video-toggle', {
                from: onlineUsers.get(socket.id)?.id,
                enabled: enabled
            });
        }
    });
    
    socket.on('call:audio-toggle', (data) => {
        const { to, enabled } = data;
        const receiverSocketId = userSockets.get(to);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('call:audio-toggle', {
                from: onlineUsers.get(socket.id)?.id,
                enabled: enabled
            });
        }
    });
    
    // ========== NOTIFICATIONS ==========
    socket.on('notification:send', (data) => {
        const { to, type, message, data: notifData } = data;
        const sender = onlineUsers.get(socket.id);
        const receiverSocketId = userSockets.get(to);
        
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('notification', {
                type: type || 'info',
                message: message,
                data: notifData,
                from: sender?.id,
                timestamp: new Date().toISOString()
            });
        }
    });
    
    // ========== ADMIN & MODERATION ==========
    socket.on('admin:ban', (data) => {
        // In production, verify admin privileges
        const { userId, reason, duration } = data;
        const admin = onlineUsers.get(socket.id);
        
        if (!admin || !admin.isAdmin) return;
        
        const userSocketId = userSockets.get(userId);
        if (userSocketId) {
            io.to(userSocketId).emit('user:banned', {
                reason: reason,
                duration: duration,
                bannedBy: admin.username
            });
            
            // Disconnect banned user
            setTimeout(() => {
                if (userSocketId && io.sockets.sockets.get(userSocketId)) {
                    io.sockets.sockets.get(userSocketId).disconnect();
                }
            }, 5000);
        }
    });
    
    socket.on('admin:warn', (data) => {
        const { userId, reason } = data;
        const admin = onlineUsers.get(socket.id);
        
        if (!admin || !admin.isAdmin) return;
        
        const userSocketId = userSockets.get(userId);
        if (userSocketId) {
            io.to(userSocketId).emit('user:warned', {
                reason: reason,
                warnedBy: admin.username
            });
        }
    });
    
    // ========== PREMIUM FEATURES ==========
    socket.on('premium:purchase', async (data) => {
        try {
            const { plan, transactionId } = data;
            const user = onlineUsers.get(socket.id);
            
            if (!user) return;
            
            // In production, verify payment with payment gateway
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + (plan === 'yearly' ? 12 : 1));
            
            const updatedUser = await db.updateUser(user.id, {
                isPremium: true,
                premiumPlan: plan,
                premiumSince: new Date().toISOString(),
                premiumExpiry: expiryDate.toISOString(),
                lastTransactionId: transactionId
            });
            
            // Update memory
            onlineUsers.set(socket.id, updatedUser);
            
            // Notify user
            socket.emit('premium:activated', {
                plan: plan,
                expiry: expiryDate.toISOString()
            });
            
            // Broadcast premium status change
            socket.broadcast.emit('user:updated', { user: updatedUser });
            
            console.log(`Premium purchased: ${user.username} (${plan})`);
        } catch (error) {
            console.error('Premium purchase error:', error);
            socket.emit('error', { message: 'Purchase failed' });
        }
    });
    
    socket.on('gift:send', (data) => {
        const { to, giftId, giftType } = data;
        const sender = onlineUsers.get(socket.id);
        const receiverSocketId = userSockets.get(to);
        
        if (!sender || !receiverSocketId) return;
        
        // Check if sender has enough coins (in production)
        const gift = {
            id: giftId,
            type: giftType,
            from: sender.id,
            fromName: sender.username,
            sentAt: new Date().toISOString(),
            value: 10 // Gift value in coins
        };
        
        // Save gift to database
        db.saveGift(gift).catch(console.error);
        
        // Send gift notification
        io.to(receiverSocketId).emit('gift:received', { gift: gift });
        
        // Deduct coins from sender (in production)
        socket.emit('coins:deducted', {
            amount: 10,
            balance: 100 // Mock balance
        });
    });
    
    // ========== DISCONNECTION HANDLING ==========
    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);
        
        const user = onlineUsers.get(socket.id);
        if (user) {
            // Update user status
            user.isOnline = false;
            user.lastSeen = new Date().toISOString();
            
            // Save to database
            db.updateUser(user.id, {
                isOnline: false,
                lastSeen: user.lastSeen
            }).catch(console.error);
            
            // Remove from memory maps
            onlineUsers.delete(socket.id);
            userSockets.delete(user.id);
            
            // Broadcast user offline status
            socket.broadcast.emit('user:offline', { userId: user.id });
            
            // End active calls
            activeCalls.forEach((call, callId) => {
                if (call.caller === user.id || call.callee === user.id) {
                    const otherUserId = call.caller === user.id ? call.callee : call.caller;
                    const otherSocketId = userSockets.get(otherUserId);
                    
                    if (otherSocketId) {
                        io.to(otherSocketId).emit('call:end', {
                            from: user.id,
                            reason: 'User disconnected'
                        });
                    }
                    
                    activeCalls.delete(callId);
                }
            });
            
            // End active chats
            activeChats.forEach((chat, chatId) => {
                if (chat.user1 === user.id || chat.user2 === user.id) {
                    const otherUserId = chat.user1 === user.id ? chat.user2 : chat.user1;
                    const otherSocketId = userSockets.get(otherUserId);
                    
                    if (otherSocketId) {
                        io.to(otherSocketId).emit('chat:end', {
                            from: user.id,
                            reason: 'User disconnected'
                        });
                    }
                    
                    activeChats.delete(chatId);
                }
            });
            
            // Leave rooms
            const roomId = userRooms.get(user.id);
            if (roomId) {
                socket.leave(roomId);
                userRooms.delete(user.id);
            }
            
            // Update global stats
            updateGlobalStats();
            
            console.log(`User went offline: ${user.username} (${user.id})`);
        }
    });
    
    // ========== ERROR HANDLING ==========
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
    
    // ========== HEALTH CHECK ==========
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
});

// ========== HELPER FUNCTIONS ==========
async function findCompatiblePartner(currentUser, preferences, countryFilter) {
    const onlineUsersList = Array.from(onlineUsers.values());
    
    // Filter out current user
    let candidates = onlineUsersList.filter(user => user.id !== currentUser.id);
    
    // Apply gender preference
    if (preferences && preferences !== 'both') {
        candidates = candidates.filter(user => user.gender === preferences);
    }
    
    // Apply country filter
    if (countryFilter) {
        candidates = candidates.filter(user => user.country === countryFilter);
    }
    
    // Filter out users already in calls
    candidates = candidates.filter(user => {
        let isInCall = false;
        activeCalls.forEach(call => {
            if (call.caller === user.id || call.callee === user.id) {
                isInCall = true;
            }
        });
        return !isInCall;
    });
    
    // Filter out users already in active chats
    candidates = candidates.filter(user => {
        let isInChat = false;
        activeChats.forEach(chat => {
            if (chat.user1 === user.id || chat.user2 === user.id) {
                isInChat = true;
            }
        });
        return !isInChat;
    });
    
    // Prioritize premium users for premium requests
    if (preferences === 'premium') {
        candidates = candidates.filter(user => user.isPremium === true);
    }
    
    // If no candidates, relax filters
    if (candidates.length === 0 && countryFilter) {
        // Remove country filter
        candidates = onlineUsersList.filter(user => 
            user.id !== currentUser.id && 
            (!preferences || preferences === 'both' || user.gender === preferences)
        );
    }
    
    // If still no candidates, remove gender filter
    if (candidates.length === 0 && preferences && preferences !== 'both') {
        candidates = onlineUsersList.filter(user => user.id !== currentUser.id);
    }
    
    // Random selection from candidates
    if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    
    return null;
}

function updateGlobalStats() {
    const stats = {
        online: onlineUsers.size,
        activeCalls: activeCalls.size,
        activeChats: activeChats.size,
        timestamp: new Date().toISOString()
    };
    
    // Broadcast to all connected clients
    io.emit('stats:update', stats);
}

// ========== EXPRESS ROUTES ==========
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        onlineUsers: onlineUsers.size,
        activeCalls: activeCalls.size,
        activeChats: activeChats.size,
        memoryUsage: process.memoryUsage()
    });
});

// Get online users
app.get('/api/users/online', (req, res) => {
    const users = Array.from(onlineUsers.values()).map(user => ({
        id: user.id,
        username: user.username,
        age: user.age,
        gender: user.gender,
        country: user.country,
        isPremium: user.isPremium,
        avatar: user.avatar,
        lastSeen: user.lastSeen
    }));
    
    res.json({ users: users, count: users.length });
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await db.getUser(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove sensitive data
        const { password, ...safeUser } = user;
        res.json(safeUser);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Search users
app.get('/api/users/search/:query', async (req, res) => {
    try {
        const users = await db.searchUsers(req.params.query);
        res.json({ users: users });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get chat history
app.get('/api/chats/:userId', async (req, res) => {
    try {
        const chats = await db.getUserChats(req.params.userId);
        res.json({ chats: chats });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get messages for a chat
app.get('/api/messages/:chatId', async (req, res) => {
    try {
        const messages = await db.getChatMessages(req.params.chatId);
        res.json({ messages: messages });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// File upload endpoint (for chat files)
app.post('/api/upload', (req, res) => {
    // In production, use multer or similar for file uploads
    res.json({ message: 'Upload endpoint - implement file handling' });
});

// Report user
app.post('/api/report', async (req, res) => {
    try {
        const { reporterId, reportedId, reason, details } = req.body;
        
        const report = {
            id: `report_${Date.now()}`,
            reporterId,
            reportedId,
            reason,
            details,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        await db.saveReport(report);
        res.json({ success: true, reportId: report.id });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// Admin endpoints (protected)
app.get('/api/admin/stats', async (req, res) => {
    // In production, add authentication middleware
    const stats = {
        totalUsers: await db.getTotalUsers(),
        totalMessages: await db.getTotalMessages(),
        totalCalls: await db.getTotalCalls(),
        premiumUsers: await db.getPremiumUsersCount(),
        reports: await db.getPendingReports(),
        timestamp: new Date().toISOString()
    };
    
    res.json(stats);
});

// Serve static files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== DATABASE BACKUP SCHEDULER ==========
function scheduleBackup() {
    // Backup every 6 hours
    setInterval(async () => {
        try {
            await db.backup();
            console.log('Database backup completed');
        } catch (error) {
            console.error('Backup failed:', error);
        }
    }, 6 * 60 * 60 * 1000);
}

// ========== CLEANUP OLD DATA ==========
function cleanupOldData() {
    // Run every hour
    setInterval(async () => {
        try {
            // Clean up old inactive chats
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            activeChats.forEach((chat, chatId) => {
                if (new Date(chat.startedAt) < twentyFourHoursAgo) {
                    activeChats.delete(chatId);
                }
            });
            
            // Clean up old call records
            activeCalls.forEach((call, callId) => {
                if (new Date(call.startedAt) < twentyFourHoursAgo) {
                    activeCalls.delete(callId);
                }
            });
            
            console.log('Cleaned up old data');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }, 60 * 60 * 1000);
}

// ========== START SERVER ==========
server.listen(PORT, HOST, () => {
    console.log(`
    ╔═══════════════════════════════════════════════╗
    ║      QUIKCHAT GLOBAL V2 SERVER STARTED       ║
    ║                                               ║
    ║     🚀 Server running on: ${HOST}:${PORT}    ║
    ║     📡 Socket.IO ready for connections       ║
    ║     🗄️  Database initialized                 ║
    ║     ⏰ Scheduled tasks started                ║
    ║                                               ║
    ╚═══════════════════════════════════════════════╝
    `);
    
    // Start scheduled tasks
    scheduleBackup();
    cleanupOldData();
    
    // Initial stats update
    updateGlobalStats();
    
    // Update stats every 30 seconds
    setInterval(updateGlobalStats, 30000);
});

// ========== GRACEFUL SHUTDOWN ==========
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
    console.log('Shutting down gracefully...');
    
    // Save all online users as offline
    onlineUsers.forEach(async (user) => {
        await db.updateUser(user.id, {
            isOnline: false,
            lastSeen: new Date().toISOString()
        });
    });
    
    // Backup database
    db.backup().then(() => {
        console.log('Final backup completed');
        process.exit(0);
    }).catch(error => {
        console.error('Final backup failed:', error);
        process.exit(1);
    });
}

// ========== DATABASE CLASS ==========
// Note: This is a simplified JSON-based database for demo purposes.
// In production, use MongoDB, PostgreSQL, or Firebase.

class JSONDatabase {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.ensureDataDir();
        this.loadData();
    }
    
    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    
    loadData() {
        try {
            this.users = this.loadFile('users.json') || {};
            this.messages = this.loadFile('messages.json') || [];
            this.chats = this.loadFile('chats.json') || [];
            this.gifts = this.loadFile('gifts.json') || [];
            this.reports = this.loadFile('reports.json') || [];
        } catch (error) {
            console.error('Error loading data:', error);
            this.users = {};
            this.messages = [];
            this.chats = [];
            this.gifts = [];
            this.reports = [];
        }
    }
    
    loadFile(filename) {
        const filePath = path.join(this.dataDir, filename);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return null;
    }
    
    saveFile(filename, data) {
        const filePath = path.join(this.dataDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    
    async saveUser(user) {
        this.users[user.id] = {
            ...user,
            updatedAt: new Date().toISOString()
        };
        
        this.saveFile('users.json', this.users);
        return this.users[user.id];
    }
    
    async getUser(userId) {
        return this.users[userId] || null;
    }
    
    async getUserByUsername(username) {
        return Object.values(this.users).find(user => 
            user.username && user.username.toLowerCase() === username.toLowerCase()
        ) || null;
    }
    
    async updateUser(userId, updates) {
        if (!this.users[userId]) {
            throw new Error('User not found');
        }
        
        this.users[userId] = {
            ...this.users[userId],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        this.saveFile('users.json', this.users);
        return this.users[userId];
    }
    
    async saveMessage(message) {
        this.messages.push({
            ...message,
            savedAt: new Date().toISOString()
        });
        
        // Keep only last 10000 messages to prevent memory issues
        if (this.messages.length > 10000) {
            this.messages = this.messages.slice(-5000);
        }
        
        this.saveFile('messages.json', this.messages);
        return message;
    }
    
    async saveGift(gift) {
        this.gifts.push(gift);
        this.saveFile('gifts.json', this.gifts);
        return gift;
    }
    
    async saveReport(report) {
        this.reports.push(report);
        this.saveFile('reports.json', this.reports);
        return report;
    }
    
    async getUserChats(userId) {
        return this.messages
            .filter(msg => msg.senderId === userId || msg.receiverId === userId)
            .reduce((chats, msg) => {
                const otherUserId = msg.senderId === userId ? msg.receiverId : msg.senderId;
                if (!chats[otherUserId]) {
                    chats[otherUserId] = {
                        userId: otherUserId,
                        lastMessage: msg,
                        messageCount: 0
                    };
                }
                chats[otherUserId].messageCount++;
                if (new Date(msg.timestamp) > new Date(chats[otherUserId].lastMessage.timestamp)) {
                    chats[otherUserId].lastMessage = msg;
                }
                return chats;
            }, {});
    }
    
    async getChatMessages(chatId) {
        return this.messages
            .filter(msg => msg.chatId === chatId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    
    async searchUsers(query) {
        const searchTerm = query.toLowerCase();
        return Object.values(this.users)
            .filter(user => 
                user.username.toLowerCase().includes(searchTerm) ||
                (user.country && user.country.toLowerCase().includes(searchTerm))
            )
            .slice(0, 50); // Limit results
    }
    
    async getTotalUsers() {
        return Object.keys(this.users).length;
    }
    
    async getTotalMessages() {
        return this.messages.length;
    }
    
    async getTotalCalls() {
        // This would need call tracking in production
        return 0;
    }
    
    async getPremiumUsersCount() {
        return Object.values(this.users).filter(user => user.isPremium).length;
    }
    
    async getPendingReports() {
        return this.reports.filter(report => report.status === 'pending').length;
    }
    
    async backup() {
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
        
        const backupData = {
            timestamp: new Date().toISOString(),
            users: this.users,
            messages: this.messages.slice(-1000), // Keep only recent messages
            chats: this.chats,
            gifts: this.gifts,
            reports: this.reports
        };
        
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        
        // Clean up old backups (keep last 7)
        const backups = fs.readdirSync(backupDir)
            .filter(file => file.startsWith('backup-'))
            .sort();
        
        if (backups.length > 7) {
            for (let i = 0; i < backups.length - 7; i++) {
                fs.unlinkSync(path.join(backupDir, backups[i]));
            }
        }
    }
}

// Export for testing
module.exports = { server, app, io };
