require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL 
      : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static('public'));

// Store active connections
const activeUsers = new Map(); // socketId -> userData
const waitingQueue = new Map(); // userId -> socketId
const activeCalls = new Map(); // callId -> {user1, user2}

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log('✅ New connection:', socket.id);

  // Join user
  socket.on('join', async (userData) => {
    try {
      console.log('📥 Join request:', userData);
      
      // Validate user data
      if (!userData || !userData.userId) {
        socket.emit('error', { message: 'Invalid user data' });
        return;
      }

      const userId = userData.userId;
      const username = userData.username || 'Anonymous';
      
      // Check if user is already connected
      for (const [existingSocketId, existingUser] of activeUsers.entries()) {
        if (existingUser.userId === userId && existingSocketId !== socket.id) {
          // Disconnect previous connection
          const oldSocket = io.sockets.sockets.get(existingSocketId);
          if (oldSocket) {
            oldSocket.disconnect();
          }
          activeUsers.delete(existingSocketId);
          break;
        }
      }

      // Create user object
      const userWithId = {
        ...userData,
        userId,
        username,
        socketId: socket.id,
        joinedAt: new Date().toISOString(),
        status: 'online'
      };

      // Store user
      socket.userId = userId;
      activeUsers.set(socket.id, userWithId);

      // Send success
      socket.emit('joined', {
        userId,
        message: 'Successfully joined QUIKCHAT Global'
      });

      // Update online count
      io.emit('online-count', {
        count: activeUsers.size
      });

      console.log(`✅ User joined: ${username} (${userId})`);

    } catch (error) {
      console.error('❌ Join error:', error);
      socket.emit('error', { message: 'Failed to join' });
    }
  });

  // Find random partner
  socket.on('find-partner', async (userData) => {
    try {
      console.log('🔍 Find partner request from:', socket.id);
      
      const currentUser = activeUsers.get(socket.id);
      if (!currentUser) {
        console.log('❌ User not registered in activeUsers');
        socket.emit('error', { message: 'User not registered. Please join first.' });
        return;
      }

      // Check if already in queue
      if (waitingQueue.has(currentUser.userId)) {
        socket.emit('status', { status: 'already-waiting' });
        return;
      }

      // Check if already in a call
      for (const [callId, call] of activeCalls.entries()) {
        if (call.user1.socketId === socket.id || call.user2.socketId === socket.id) {
          socket.emit('error', { message: 'Already in a call' });
          return;
        }
      }

      // Check queue for available partners
      if (waitingQueue.size > 0) {
        // Find first available partner
        const [partnerId, partnerSocketId] = Array.from(waitingQueue.entries())[0];
        const partnerSocket = io.sockets.sockets.get(partnerSocketId);

        if (partnerSocket && partnerSocket.connected) {
          // Create call ID
          const callId = uuidv4();
          
          // Remove from queue
          waitingQueue.delete(currentUser.userId);
          waitingQueue.delete(partnerId);

          // Store call
          activeCalls.set(callId, {
            user1: {
              userId: currentUser.userId,
              socketId: socket.id,
              userData: currentUser
            },
            user2: {
              userId: partnerId,
              socketId: partnerSocketId,
              userData: activeUsers.get(partnerSocketId)
            },
            createdAt: new Date().toISOString()
          });

          // Notify both users
          socket.emit('partner-found', {
            callId,
            partner: activeUsers.get(partnerSocketId),
            role: 'caller'
          });

          partnerSocket.emit('partner-found', {
            callId,
            partner: currentUser,
            role: 'callee'
          });

          console.log(`✅ Match made: ${currentUser.userId} ↔ ${partnerId}`);
          return;
        } else {
          // Clean up stale connection
          waitingQueue.delete(partnerId);
        }
      }

      // Add to waiting queue
      waitingQueue.set(currentUser.userId, socket.id);
      socket.emit('status', { 
        status: 'waiting', 
        position: waitingQueue.size,
        estimatedWait: Math.max(5, waitingQueue.size * 3)
      });

      console.log(`⏳ User added to queue: ${currentUser.userId}`);

    } catch (error) {
      console.error('❌ Find partner error:', error);
      socket.emit('error', { message: 'Failed to find partner' });
    }
  });

  // WebRTC Signaling
  socket.on('webrtc-signal', (data) => {
    try {
      const { callId, signal, type } = data;
      const call = activeCalls.get(callId);
      
      if (!call) {
        socket.emit('error', { message: 'Call not found' });
        return;
      }

      // Find partner socket
      const partnerSocketId = 
        call.user1.socketId === socket.id ? call.user2.socketId : call.user1.socketId;
      const partnerSocket = io.sockets.sockets.get(partnerSocketId);

      if (partnerSocket) {
        partnerSocket.emit('webrtc-signal', {
          callId,
          signal,
          type,
          from: socket.id
        });
      }
    } catch (error) {
      console.error('WebRTC signal error:', error);
    }
  });

  // Send message
  socket.on('send-message', (data) => {
    try {
      const { callId, message, type = 'text' } = data;
      const call = activeCalls.get(callId);
      
      if (!call) return;

      const partnerSocketId = 
        call.user1.socketId === socket.id ? call.user2.socketId : call.user1.socketId;
      const partnerSocket = io.sockets.sockets.get(partnerSocketId);

      if (partnerSocket) {
        const sender = activeUsers.get(socket.id);
        partnerSocket.emit('receive-message', {
          message,
          type,
          from: sender.userId,
          senderName: sender.username,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  });

  // Next partner request
  socket.on('next-partner', () => {
    try {
      // Find current call
      let currentCallId = null;
      for (const [callId, call] of activeCalls.entries()) {
        if (call.user1.socketId === socket.id || call.user2.socketId === socket.id) {
          currentCallId = callId;
          break;
        }
      }

      if (currentCallId) {
        const call = activeCalls.get(currentCallId);
        
        // Notify partner
        const partnerSocketId = 
          call.user1.socketId === socket.id ? call.user2.socketId : call.user1.socketId;
        const partnerSocket = io.sockets.sockets.get(partnerSocketId);
        
        if (partnerSocket) {
          partnerSocket.emit('partner-left', {
            reason: 'partner_skipped'
          });
        }

        // Remove call
        activeCalls.delete(currentCallId);
      }

      console.log(`🔄 User requested next partner: ${socket.id}`);

    } catch (error) {
      console.error('Next partner error:', error);
    }
  });

  // Report user
  socket.on('report-user', async (data) => {
    try {
      const { reportedUserId, reason, details } = data;
      
      console.log(`🚨 Report submitted: ${reportedUserId} - ${reason}`);
      
      socket.emit('report-submitted', {
        success: true,
        message: 'Report submitted successfully'
      });

    } catch (error) {
      console.error('Report error:', error);
      socket.emit('error', { message: 'Failed to submit report' });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    try {
      const userData = activeUsers.get(socket.id);
      if (!userData) return;

      const userId = userData.userId;

      // Remove from active users
      activeUsers.delete(socket.id);

      // Remove from waiting queue
      waitingQueue.delete(userId);

      // Find and end active calls
      for (const [callId, call] of activeCalls.entries()) {
        if (call.user1.socketId === socket.id || call.user2.socketId === socket.id) {
          // Notify partner
          const partnerSocketId = 
            call.user1.socketId === socket.id ? call.user2.socketId : call.user1.socketId;
          const partnerSocket = io.sockets.sockets.get(partnerSocketId);
          
          if (partnerSocket) {
            partnerSocket.emit('partner-disconnected', {
              reason: 'disconnected'
            });
          }

          activeCalls.delete(callId);
          break;
        }
      }

      // Update online count
      io.emit('online-count', {
        count: activeUsers.size
      });

      console.log(`❌ User disconnected: ${userId}`);

    } catch (error) {
      console.error('Disconnect cleanup error:', error);
    }
  });
});

// Helper function to cleanup waiting queue
function cleanupWaitingQueue() {
  for (const [userId, socketId] of waitingQueue.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket || !socket.connected) {
      waitingQueue.delete(userId);
    }
  }
}

// Set up periodic cleanup
setInterval(cleanupWaitingQueue, 30000);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size,
    waitingQueue: waitingQueue.size,
    activeCalls: activeCalls.size
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    activeUsers: activeUsers.size,
    waitingQueue: waitingQueue.size,
    activeCalls: activeCalls.size,
    uptime: process.uptime()
  });
});

// Serve main page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ⚡ QUIKCHAT Global Server ⚡
  ----------------------------
  Server running on port ${PORT}
  Mode: ${process.env.NODE_ENV || 'development'}
  Health check: http://localhost:${PORT}/api/health
  ----------------------------
  `);
});

module.exports = { app, server, io };
