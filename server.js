// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.static('public'));

const users = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // User registration
    socket.on('register', (userData) => {
        users.set(socket.id, {
            ...userData,
            socketId: socket.id,
            online: true,
            room: null
        });
        
        socket.emit('registered', { success: true });
        
        // Notify all users about new online user
        io.emit('user:online', { user: userData });
        
        // Send current online users
        const onlineUsers = Array.from(users.values())
            .filter(u => u.online && u.socketId !== socket.id);
        socket.emit('users:list', { users: onlineUsers });
    });

    // Find random partner
    socket.on('chat:find-partner', (data) => {
        const currentUser = users.get(socket.id);
        if (!currentUser) return;

        const availableUsers = Array.from(users.values()).filter(u => 
            u.online && 
            u.socketId !== socket.id && 
            !u.room &&
            (data.preference === 'both' || u.gender === data.preference)
        );

        if (availableUsers.length > 0) {
            const randomPartner = availableUsers[Math.floor(Math.random() * availableUsers.length)];
            
            // Create room
            const roomId = `room_${socket.id}_${randomPartner.socketId}`;
            rooms.set(roomId, {
                id: roomId,
                user1: socket.id,
                user2: randomPartner.socket.id,
                type: 'video'
            });

            // Update users
            currentUser.room = roomId;
            users.get(randomPartner.socketId).room = roomId;

            // Notify both users
            socket.emit('chat:start', { 
                partner: randomPartner,
                type: 'video'
            });
            io.to(randomPartner.socketId).emit('chat:request', {
                from: socket.id,
                user: currentUser,
                type: 'video'
            });
        } else {
            socket.emit('chat:no-partner', { message: 'No available users found' });
        }
    });

    // Handle call signaling
    socket.on('call:request', (data) => {
        io.to(data.to).emit('call:request', {
            from: socket.id,
            offer: data.offer,
            user: users.get(socket.id)
        });
    });

    socket.on('call:accept', (data) => {
        io.to(data.to).emit('call:accept', {
            from: socket.id,
            answer: data.answer
        });
    });

    socket.on('call:reject', (data) => {
        io.to(data.to).emit('call:reject', { from: socket.id });
    });

    socket.on('call:offer', (data) => {
        io.to(data.to).emit('call:offer', {
            from: socket.id,
            offer: data.offer
        });
    });

    socket.on('call:answer', (data) => {
        io.to(data.to).emit('call:answer', {
            from: socket.id,
            answer: data.answer
        });
    });

    socket.on('call:ice-candidate', (data) => {
        io.to(data.to).emit('call:ice-candidate', {
            from: socket.id,
            candidate: data.candidate
        });
    });

    socket.on('call:end', (data) => {
        io.to(data.to).emit('call:end', { from: socket.id });
        
        // Clean up room
        const user = users.get(socket.id);
        if (user && user.room) {
            const room = rooms.get(user.room);
            if (room) {
                rooms.delete(user.room);
            }
            user.room = null;
        }
    });

    // Chat messages
    socket.on('chat:message', (data) => {
        io.to(data.to).emit('chat:message', {
            from: socket.id,
            message: data.message
        });
    });

    // Disconnect
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            user.online = false;
            
            // Notify others
            io.emit('user:offline', { userId: socket.id });
            
            // Clean up room if in one
            if (user.room) {
                const room = rooms.get(user.room);
                if (room) {
                    const otherUserId = room.user1 === socket.id ? room.user2 : room.user1;
                    io.to(otherUserId).emit('chat:end', { reason: 'Partner disconnected' });
                    rooms.delete(user.room);
                    
                    const otherUser = users.get(otherUserId);
                    if (otherUser) {
                        otherUser.room = null;
                    }
                }
            }
            
            users.delete(socket.id);
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
