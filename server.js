require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const helmet = require('helmet');
const path = require('path');

// Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (Object.keys(serviceAccount).length > 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active users
const activeUsers = new Map();
const waitingUsers = [];
const activeCalls = new Map();

// API Routes
app.get('/api/stats', (req, res) => {
  res.json({
    online: activeUsers.size,
    activeCalls: activeCalls.size,
    waiting: waitingUsers.length
  });
});

app.post('/api/create-payment', async (req, res) => {
  const { userId, amount } = req.body;
  
  // Razorpay integration placeholder
  const order = {
    id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount: amount * 100, // in paise
    currency: 'INR'
  };
  
  res.json(order);
});

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);
  
  socket.on('register-user', async (userData) => {
    const { fingerprint, username, age, country, bio, photo, gender, isModel, perMinuteRate } = userData;
    
    const user = {
      socketId: socket.id,
      userId: fingerprint,
      username,
      age,
      country,
      bio,
      photo,
      gender,
      isModel: isModel || false,
      perMinuteRate: perMinuteRate || 0,
      balance: 0,
      earnings: 0,
      joinedAt: Date.now(),
      isOnline: true
    };
    
    // Save to active users
    activeUsers.set(socket.id, user);
    
    // Save to Firebase
    try {
      await db.ref(`users/${fingerprint}`).set(user);
    } catch (err) {
      console.error('Firebase save error:', err);
    }
    
    socket.emit('user-registered', user);
    io.emit('online-count', activeUsers.size);
  });
  
  socket.on('find-random-match', async (preferences) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    
    // Remove from waiting if already there
    const index = waitingUsers.indexOf(socket.id);
    if (index > -1) waitingUsers.splice(index, 1);
    
    // Add to waiting list
    waitingUsers.push(socket.id);
    
    // Try to find match
    findMatch(socket.id, preferences);
  });
  
  socket.on('request-private-chat', async (data) => {
    const { toUserId, coinsPerMinute } = data;
    const fromUser = activeUsers.get(socket.id);
    
    // Find target user's socket
    let targetSocketId = null;
    for (let [sid, user] of activeUsers) {
      if (user.userId === toUserId) {
        targetSocketId = sid;
        break;
      }
    }
    
    if (targetSocketId && fromUser) {
      io.to(targetSocketId).emit('private-request', {
        fromUser: {
          userId: fromUser.userId,
          username: fromUser.username,
          age: fromUser.age,
          country: fromUser.country,
          photo: fromUser.photo
        },
        coinsPerMinute: coinsPerMinute,
        requestId: `req_${Date.now()}`
      });
    }
  });
  
  socket.on('accept-private-chat', async (data) => {
    const { requestId, fromUserId, coinsPerMinute } = data;
    const modelUser = activeUsers.get(socket.id);
    
    // Find requester's socket
    let requesterSocketId = null;
    for (let [sid, user] of activeUsers) {
      if (user.userId === fromUserId) {
        requesterSocketId = sid;
        break;
      }
    }
    
    if (requesterSocketId && modelUser) {
      // Create private room
      const roomId = `private_${fromUserId}_${modelUser.userId}`;
      
      // Join both to room
      socket.join(roomId);
      io.sockets.sockets.get(requesterSocketId)?.join(roomId);
      
      // Notify both
      io.to(roomId).emit('private-chat-started', {
        roomId,
        coinsPerMinute,
        modelUser,
        startedAt: Date.now()
      });
      
      // Track call
      activeCalls.set(roomId, {
        roomId,
        modelId: modelUser.userId,
        userId: fromUserId,
        coinsPerMinute,
        startedAt: Date.now(),
        coinsDeducted: 0
      });
    }
  });
  
  socket.on('webrtc-signal', (data) => {
    const { to, signal } = data;
    io.to(to).emit('webrtc-signal', {
      from: socket.id,
      signal: signal
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from active users
    activeUsers.delete(socket.id);
    
    // Remove from waiting
    const index = waitingUsers.indexOf(socket.id);
    if (index > -1) waitingUsers.splice(index, 1);
    
    io.emit('online-count', activeUsers.size);
  });
});

// Matchmaking function
function findMatch(socketId, preferences) {
  if (waitingUsers.length < 2) return;
  
  const user1 = activeUsers.get(socketId);
  if (!user1) return;
  
  // Find compatible match
  for (let i = 0; i < waitingUsers.length; i++) {
    const otherId = waitingUsers[i];
    if (otherId === socketId) continue;
    
    const user2 = activeUsers.get(otherId);
    if (!user2) continue;
    
    // Check preferences
    if (preferences.gender && preferences.gender !== 'any') {
      if (preferences.gender !== user2.gender) continue;
    }
    
    if (preferences.country && preferences.country !== 'any') {
      if (preferences.country !== user2.country) continue;
    }
    
    // Found match - create room
    const roomId = `room_${socketId}_${otherId}`;
    
    // Remove both from waiting
    const index1 = waitingUsers.indexOf(socketId);
    const index2 = waitingUsers.indexOf(otherId);
    if (index1 > -1) waitingUsers.splice(index1, 1);
    if (index2 > -1) waitingUsers.splice(index2, 1);
    
    // Join room
    io.sockets.sockets.get(socketId)?.join(roomId);
    io.sockets.sockets.get(otherId)?.join(roomId);
    
    // Send match info
    io.to(roomId).emit('match-found', {
      roomId,
      user1: user1,
      user2: user2
    });
    
    break;
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
