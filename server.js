/* ========== QUIKCHAT GLOBAL - MINIMAL SERVER ========== */
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

// Initialize app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // For development, enable in production
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active users and calls
const activeUsers = new Map(); // socket.id -> user data
const userSockets = new Map(); // user.id -> socket.id
const activeCalls = new Map(); // callId -> call data

// ========== SOCKET.IO HANDLERS ==========
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  // Register user
  socket.on('register', (userData) => {
    try {
      const user = {
        id: userData.id || `user_${Date.now()}`,
        socketId: socket.id,
        username: userData.username,
        gender: userData.gender,
        country: userData.country,
        age: userData.age,
        isOnline: true
      };
      
      activeUsers.set(socket.id, user);
      userSockets.set(user.id, socket.id);
      
      socket.emit('user:registered', { user });
      
      // Join user to personal room
      socket.join(`user:${user.id}`);
      
      console.log(`👤 User registered: ${user.username}`);
    } catch (error) {
      socket.emit('error', { message: 'Registration failed' });
    }
  });
  
  // Find random partner
  socket.on('find:partner', (data) => {
    try {
      const currentUser = activeUsers.get(socket.id);
      if (!currentUser) return;
      
      // Get all online users except current
      const availableUsers = Array.from(activeUsers.values())
        .filter(user => 
          user.socketId !== socket.id && 
          user.isOnline
        );
      
      if (availableUsers.length === 0) {
        socket.emit('partner:not-found', { message: 'No users online' });
        return;
      }
      
      // Apply filters
      let filteredUsers = availableUsers;
      
      if (data.gender && data.gender !== 'both') {
        filteredUsers = filteredUsers.filter(u => u.gender === data.gender);
      }
      
      if (data.country) {
        filteredUsers = filteredUsers.filter(u => u.country === data.country);
      }
      
      // If no filtered users, use all available
      if (filteredUsers.length === 0) {
        filteredUsers = availableUsers;
      }
      
      // Select random partner
      const randomPartner = filteredUsers[Math.floor(Math.random() * filteredUsers.length)];
      
      // Create call session
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const callData = {
        id: callId,
        user1: currentUser.id,
        user2: randomPartner.id,
        status: 'connecting',
        createdAt: new Date().toISOString()
      };
      
      activeCalls.set(callId, callData);
      
      // Notify both users
      socket.emit('partner:found', {
        partner: randomPartner,
        callId: callId
      });
      
      const partnerSocket = io.sockets.sockets.get(randomPartner.socketId);
      if (partnerSocket) {
        partnerSocket.emit('partner:found', {
          partner: currentUser,
          callId: callId
        });
      }
      
    } catch (error) {
      socket.emit('error', { message: 'Failed to find partner' });
    }
  });
  
  // WebRTC signaling
  socket.on('webrtc:offer', (data) => {
    const { to, offer, callId } = data;
    const receiverSocketId = userSockets.get(to);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('webrtc:offer', {
        from: socket.id,
        offer: offer,
        callId: callId
      });
    }
  });
  
  socket.on('webrtc:answer', (data) => {
    const { to, answer } = data;
    const receiverSocketId = userSockets.get(to);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('webrtc:answer', {
        from: socket.id,
        answer: answer
      });
    }
  });
  
  socket.on('webrtc:ice-candidate', (data) => {
    const { to, candidate } = data;
    const receiverSocketId = userSockets.get(to);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('webrtc:ice-candidate', {
        from: socket.id,
        candidate: candidate
      });
    }
  });
  
  // Chat messages
  socket.on('chat:message', (data) => {
    const { to, message } = data;
    const receiverSocketId = userSockets.get(to);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('chat:message', {
        from: socket.id,
        message: message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // End call
  socket.on('call:end', (data) => {
    const { callId } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      // Notify both users
      const user1Socket = userSockets.get(call.user1);
      const user2Socket = userSockets.get(call.user2);
      
      if (user1Socket) {
        io.to(user1Socket).emit('call:ended', { callId });
      }
      if (user2Socket) {
        io.to(user2Socket).emit('call:ended', { callId });
      }
      
      // Remove from active calls
      activeCalls.delete(callId);
    }
  });
  
  // Disconnection
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    const user = activeUsers.get(socket.id);
    if (user) {
      activeUsers.delete(socket.id);
      userSockets.delete(user.id);
      
      // End any active calls
      activeCalls.forEach((call, callId) => {
        if (call.user1 === user.id || call.user2 === user.id) {
          const otherUserId = call.user1 === user.id ? call.user2 : call.user1;
          const otherSocketId = userSockets.get(otherUserId);
          
          if (otherSocketId) {
            io.to(otherSocketId).emit('call:ended', { 
              callId,
              reason: 'Partner disconnected'
            });
          }
          
          activeCalls.delete(callId);
        }
      });
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    onlineUsers: activeUsers.size,
    activeCalls: activeCalls.size
  });
});

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  🚀 QuikChat Global Server Started
  📍 Port: ${PORT}
  🌐 URL: http://localhost:${PORT}
  ⏰ Time: ${new Date().toLocaleTimeString()}
  `);
});
