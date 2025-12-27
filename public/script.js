/* ========== QUIKCHAT GLOBAL - CLIENT SCRIPT ========== */

class QuikChatApp {
    constructor() {
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        };
        
        this.state = {
            user: null,
            partner: null,
            socket: null,
            peerConnection: null,
            localStream: null,
            remoteStream: null,
            dataChannel: null,
            isCallActive: false,
            callStartTime: null,
            callTimer: null,
            currentScreen: 'loading'
        };
        
        this.init();
    }
    
    async init() {
        this.loadUser();
        await this.initSocket();
        this.setupEventListeners();
        this.switchScreen('home');
    }
    
    loadUser() {
        const savedUser = localStorage.getItem('quikchat_user');
        if (savedUser) {
            this.state.user = JSON.parse(savedUser);
        } else {
            // Generate random user
            this.state.user = {
                id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                username: `User${Math.floor(Math.random() * 10000)}`,
                gender: ['male', 'female', 'other'][Math.floor(Math.random() * 3)],
                country: ['us', 'in', 'gb', 'ca', 'au', 'de', 'fr', 'jp'][Math.floor(Math.random() * 8)],
                age: Math.floor(Math.random() * 30) + 18
            };
            localStorage.setItem('quikchat_user', JSON.stringify(this.state.user));
        }
    }
    
    initSocket() {
        return new Promise((resolve) => {
            const socketUrl = window.location.origin;
            this.state.socket = io(socketUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });
            
            this.state.socket.on('connect', () => {
                console.log('✅ Connected to server');
                this.showToast('Connected', 'success');
                
                // Register user
                this.state.socket.emit('register', this.state.user);
                resolve();
            });
            
            this.state.socket.on('user:registered', (data) => {
                console.log('✅ User registered:', data.user);
            });
            
            this.state.socket.on('partner:found', this.handlePartnerFound.bind(this));
            this.state.socket.on('partner:not-found', this.handlePartnerNotFound.bind(this));
            this.state.socket.on('webrtc:offer', this.handleWebRTCOffer.bind(this));
            this.state.socket.on('webrtc:answer', this.handleWebRTCAnswer.bind(this));
            this.state.socket.on('webrtc:ice-candidate', this.handleICECandidate.bind(this));
            this.state.socket.on('chat:message', this.handleChatMessage.bind(this));
            this.state.socket.on('call:ended', this.handleCallEnded.bind(this));
            
            this.state.socket.on('disconnect', () => {
                this.showToast('Disconnected from server', 'warning');
            });
            
            this.state.socket.on('error', (error) => {
                console.error('Socket error:', error);
                this.showToast(error.message || 'Connection error', 'danger');
            });
        });
    }
    
    async findPartner() {
        const gender = document.querySelector('.option-card.active')?.dataset.gender || 'both';
        const country = document.getElementById('countrySelect').value;
        
        this.showLoading('Finding a partner...');
        
        this.state.socket.emit('find:partner', {
            gender: gender,
            country: country || undefined
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
            if (!this.state.isCallActive) {
                this.hideLoading();
                this.showToast('No partners found. Try again!', 'warning');
            }
        }, 30000);
    }
    
    async startCall(partner, callId) {
        try {
            // Get user media
            this.state.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Create peer connection
            this.state.peerConnection = new RTCPeerConnection({
                iceServers: this.config.iceServers
            });
            
            // Add local stream
            this.state.localStream.getTracks().forEach(track => {
                this.state.peerConnection.addTrack(track, this.state.localStream);
            });
            
            // Create data channel for chat
            this.state.dataChannel = this.state.peerConnection.createDataChannel('chat');
            this.setupDataChannel();
            
            // ICE candidates
            this.state.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.state.socket.emit('webrtc:ice-candidate', {
                        to: partner.id,
                        candidate: event.candidate,
                        callId: callId
                    });
                }
            };
            
            // Remote stream
            this.state.peerConnection.ontrack = (event) => {
                if (!this.state.remoteStream) {
                    this.state.remoteStream = new MediaStream();
                }
                this.state.remoteStream.addTrack(event.track);
                
                // Update remote video
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo) {
                    remoteVideo.srcObject = this.state.remoteStream;
                }
            };
            
            // Connection state
            this.state.peerConnection.onconnectionstatechange = () => {
                const state = this.state.peerConnection.connectionState;
                console.log('Connection state:', state);
                
                if (state === 'connected') {
                    this.state.isCallActive = true;
                    this.startCallTimer();
                    this.showToast('Call connected!', 'success');
                    this.hideLoading();
                } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                    this.endCall();
                }
            };
            
            // Create offer
            const offer = await this.state.peerConnection.createOffer();
            await this.state.peerConnection.setLocalDescription(offer);
            
            // Send offer to partner
            this.state.socket.emit('webrtc:offer', {
                to: partner.id,
                offer: offer,
                callId: callId
            });
            
            // Store partner info
            this.state.partner = partner;
            this.state.callId = callId;
            
            // Switch to call screen
            this.updatePartnerInfo(partner);
            this.switchScreen('videoChat');
            
            // Update local video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.state.localStream;
            }
            
        } catch (error) {
            console.error('Error starting call:', error);
            this.showToast('Failed to access camera/microphone', 'danger');
            this.endCall();
        }
    }
    
    async handleWebRTCOffer(data) {
        const { from, offer, callId } = data;
        
        if (this.state.isCallActive) {
            return; // Already in a call
        }
        
        // Show incoming call UI
        this.showIncomingCall(from, callId, offer);
    }
    
    async acceptCall(partnerId, callId, offer) {
        try {
            // Get user media
            this.state.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Create peer connection
            this.state.peerConnection = new RTCPeerConnection({
                iceServers: this.config.iceServers
            });
            
            // Add local stream
            this.state.localStream.getTracks().forEach(track => {
                this.state.peerConnection.addTrack(track, this.state.localStream);
            });
            
            // Data channel
            this.state.peerConnection.ondatachannel = (event) => {
                this.state.dataChannel = event.channel;
                this.setupDataChannel();
            };
            
            // ICE candidates
            this.state.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.state.socket.emit('webrtc:ice-candidate', {
                        to: partnerId,
                        candidate: event.candidate,
                        callId: callId
                    });
                }
            };
            
            // Remote stream
            this.state.peerConnection.ontrack = (event) => {
                if (!this.state.remoteStream) {
                    this.state.remoteStream = new MediaStream();
                }
                this.state.remoteStream.addTrack(event.track);
                
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteVideo) {
                    remoteVideo.srcObject = this.state.remoteStream;
                }
            };
            
            // Set remote description
            await this.state.peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
            );
            
            // Create answer
            const answer = await this.state.peerConnection.createAnswer();
            await this.state.peerConnection.setLocalDescription(answer);
            
            // Send answer
            this.state.socket.emit('webrtc:answer', {
                to: partnerId,
                answer: answer,
                callId: callId
            });
            
            this.state.callId = callId;
            this.switchScreen('videoChat');
            
            // Update local video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.state.localStream;
            }
            
        } catch (error) {
            console.error('Error accepting call:', error);
            this.showToast('Failed to accept call', 'danger');
        }
    }
    
    handleWebRTCAnswer(data) {
        const { answer } = data;
        if (this.state.peerConnection) {
            this.state.peerConnection.setRemoteDescription(
                new RTCSessionDescription(answer)
            );
        }
    }
    
    handleICECandidate(data) {
        const { candidate } = data;
        if (this.state.peerConnection) {
            this.state.peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        }
    }
    
    handlePartnerFound(data) {
        const { partner, callId } = data;
        this.hideLoading();
        this.startCall(partner, callId);
    }
    
    handlePartnerNotFound(data) {
        this.hideLoading();
        this.showToast(data.message || 'No partner found', 'warning');
    }
    
    handleChatMessage(data) {
        const { message, from, timestamp } = data;
        this.addMessageToChat(message, 'received');
    }
    
    handleCallEnded(data) {
        this.endCall();
        if (data.reason) {
            this.showToast(`Call ended: ${data.reason}`, 'info');
        }
    }
    
    endCall() {
        // Stop call timer
        if (this.state.callTimer) {
            clearInterval(this.state.callTimer);
            this.state.callTimer = null;
        }
        
        // Close peer connection
        if (this.state.peerConnection) {
            this.state.peerConnection.close();
            this.state.peerConnection = null;
        }
        
        // Stop media tracks
        if (this.state.localStream) {
            this.state.localStream.getTracks().forEach(track => track.stop());
            this.state.localStream = null;
        }
        
        if (this.state.remoteStream) {
            this.state.remoteStream.getTracks().forEach(track => track.stop());
            this.state.remoteStream = null;
        }
        
        // Clear video elements
        const remoteVideo = document.getElementById('remoteVideo');
        const localVideo = document.getElementById('localVideo');
        if (remoteVideo) remoteVideo.srcObject = null;
        if (localVideo) localVideo.srcObject = null;
        
        // Notify server
        if (this.state.callId && this.state.socket) {
            this.state.socket.emit('call:end', { callId: this.state.callId });
        }
        
        // Reset state
        this.state.isCallActive = false;
        this.state.partner = null;
        this.state.callId = null;
        this.state.dataChannel = null;
        
        // Clear chat
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        
        // Switch to home
        this.switchScreen('home');
    }
    
    // UI Methods
    switchScreen(screenName) {
        this.state.currentScreen = screenName;
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(`${screenName}Screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-message">${message}</div>
                <button class="toast-close">&times;</button>
            </div>
        `;
        
        const container = document.getElementById('toastContainer');
        if (container) {
            container.appendChild(toast);
            
            // Auto remove
            setTimeout(() => {
                toast.classList.add('toast-hide');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
            
            // Close button
            toast.querySelector('.toast-close').addEventListener('click', () => {
                toast.classList.add('toast-hide');
                setTimeout(() => toast.remove(), 300);
            });
        }
    }
    
    showLoading(message) {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.querySelector('p').textContent = message;
            loadingScreen.classList.add('active');
        }
    }
    
    hideLoading() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('active');
        }
    }
    
    updatePartnerInfo(partner) {
        const elements = {
            name: document.getElementById('partnerName'),
            nameOverlay: document.getElementById('partnerNameOverlay'),
            country: document.getElementById('partnerCountry'),
            avatar: document.getElementById('partnerAvatar')
        };
        
        if (elements.name) elements.name.textContent = partner.username;
        if (elements.nameOverlay) elements.nameOverlay.textContent = partner.username;
        if (elements.country) {
            const countries = {
                us: '🇺🇸 USA', in: '🇮🇳 India', gb: '🇬🇧 UK',
                ca: '🇨🇦 Canada', au: '🇦🇺 Australia', de: '🇩🇪 Germany',
                fr: '🇫🇷 France', jp: '🇯🇵 Japan'
            };
            elements.country.textContent = countries[partner.country] || '🌍 Unknown';
        }
        if (elements.avatar) {
            elements.avatar.innerHTML = partner.gender === 'male' ? '👨' : 
                                     partner.gender === 'female' ? '👩' : '🧑';
        }
    }
    
    startCallTimer() {
        this.state.callStartTime = Date.now();
        this.state.callTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.state.callStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            
            const timerElement = document.getElementById('callTimer');
            if (timerElement) {
                timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    setupDataChannel() {
        if (!this.state.dataChannel) return;
        
        this.state.dataChannel.onopen = () => {
            console.log('✅ Data channel opened');
            this.addMessageToChat('Connected! You can now chat.', 'system');
        };
        
        this.state.dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'message') {
                    this.addMessageToChat(data.content, 'received');
                }
            } catch (error) {
                this.addMessageToChat(event.data, 'received');
            }
        };
    }
    
    addMessageToChat(message, type) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-content">${this.escapeHtml(message)}</div>
            <div class="message-time">${time}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Also send via data channel if available
        if (type === 'sent' && this.state.dataChannel && this.state.dataChannel.readyState === 'open') {
            this.state.dataChannel.send(JSON.stringify({
                type: 'message',
                content: message,
                timestamp: new Date().toISOString()
            }));
        }
        
        // Send via socket for reliability
        if (type === 'sent' && this.state.partner && this.state.socket) {
            this.state.socket.emit('chat:message', {
                to: this.state.partner.id,
                message: message
            });
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showIncomingCall(partnerId, callId, offer) {
        // Create incoming call modal
        const modal = document.createElement('div');
        modal.className = 'incoming-call-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Incoming Call</h3>
                </div>
                <div class="modal-body">
                    <div class="caller-info">
                        <div class="avatar large">📞</div>
                        <p>Someone wants to video chat!</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger" id="rejectCall">Decline</button>
                    <button class="btn btn-success" id="acceptCall">Accept</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        document.getElementById('rejectCall').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('acceptCall').addEventListener('click', () => {
            modal.remove();
            this.acceptCall(partnerId, callId, offer);
        });
        
        // Auto reject after 30 seconds
        setTimeout(() => {
            if (document.body.contains(modal)) {
                modal.remove();
            }
        }, 30000);
    }
    
    setupEventListeners() {
        // Home screen buttons
        document.getElementById('startVideoChat')?.addEventListener('click', () => {
            this.findPartner();
        });
        
        document.getElementById('startTextChat')?.addEventListener('click', () => {
            this.showToast('Text chat coming soon!', 'info');
        });
        
        // Option cards
        document.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.option-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
        });
        
        // Call controls
        document.getElementById('toggleVideo')?.addEventListener('click', () => {
            if (this.state.localStream) {
                const videoTrack = this.state.localStream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.enabled = !videoTrack.enabled;
                    const btn = document.getElementById('toggleVideo');
                    btn.classList.toggle('disabled', !videoTrack.enabled);
                    btn.innerHTML = videoTrack.enabled ? 
                        '<i class="fas fa-video"></i>' : 
                        '<i class="fas fa-video-slash"></i>';
                }
            }
        });
        
        document.getElementById('toggleAudio')?.addEventListener('click', () => {
            if (this.state.localStream) {
                const audioTrack = this.state.localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !audioTrack.enabled;
                    const btn = document.getElementById('toggleAudio');
                    btn.classList.toggle('disabled', !audioTrack.enabled);
                    btn.innerHTML = audioTrack.enabled ? 
                        '<i class="fas fa-microphone"></i>' : 
                        '<i class="fas fa-microphone-slash"></i>';
                }
            }
        });
        
        document.getElementById('endCall')?.addEventListener('click', () => {
            this.endCall();
        });
        
        document.getElementById('endCallBtn')?.addEventListener('click', () => {
            this.endCall();
        });
        
        // Chat
        document.getElementById('sendMessage')?.addEventListener('click', () => {
            this.sendMessage();
        });
        
        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // Toggle chat panel
        document.getElementById('toggleChat')?.addEventListener('click', () => {
            const chatPanel = document.getElementById('chatPanel');
            if (chatPanel) {
                chatPanel.classList.toggle('open');
            }
        });
        
        document.querySelector('.close-chat')?.addEventListener('click', () => {
            const chatPanel = document.getElementById('chatPanel');
            if (chatPanel) {
                chatPanel.classList.remove('open');
            }
        });
        
        // Swap camera
        document.getElementById('swapCamera')?.addEventListener('click', async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                
                if (videoDevices.length > 1) {
                    const currentDevice = this.state.localStream?.getVideoTracks()[0]?.label;
                    const otherDevice = videoDevices.find(d => d.label !== currentDevice);
                    
                    if (otherDevice) {
                        const newStream = await navigator.mediaDevices.getUserMedia({
                            video: { deviceId: { exact: otherDevice.deviceId } },
                            audio: true
                        });
                        
                        // Replace video track
                        const newVideoTrack = newStream.getVideoTracks()[0];
                        const sender = this.state.peerConnection?.getSenders()
                            .find(s => s.track?.kind === 'video');
                        
                        if (sender && newVideoTrack) {
                            await sender.replaceTrack(newVideoTrack);
                        }
                        
                        // Update local stream
                        if (this.state.localStream) {
                            this.state.localStream.getVideoTracks()[0].stop();
                            this.state.localStream.addTrack(newVideoTrack);
                            
                            const localVideo = document.getElementById('localVideo');
                            if (localVideo) {
                                localVideo.srcObject = this.state.localStream;
                            }
                        }
                        
                        newStream.getAudioTracks()[0].stop(); // Keep only video
                    }
                }
            } catch (error) {
                console.error('Error swapping camera:', error);
            }
        });
        
        // Fullscreen
        document.getElementById('toggleScreen')?.addEventListener('click', () => {
            const videoWrapper = document.querySelector('.remote-video-wrapper');
            if (!document.fullscreenElement) {
                videoWrapper.requestFullscreen().catch(console.error);
            } else {
                document.exitFullscreen();
            }
        });
    }
    
    sendMessage() {
        const input = document.getElementById('messageInput');
        if (!input || !input.value.trim()) return;
        
        const message = input.value.trim();
        this.addMessageToChat(message, 'sent');
        input.value = '';
        input.focus();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.quikChat = new QuikChatApp();
});

// Add PWA install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    
    const installBtn = document.createElement('button');
    installBtn.className = 'install-btn';
    installBtn.innerHTML = '<i class="fas fa-download"></i> Install App';
    installBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        padding: 10px 20px;
        background: #3db0ff;
        color: white;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(61, 176, 255, 0.3);
    `;
    
    installBtn.addEventListener('click', () => {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            window.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted install');
                }
                window.deferredPrompt = null;
            });
        }
    });
    
    document.body.appendChild(installBtn);
    
    // Auto hide after 10 seconds
    setTimeout(() => {
        if (installBtn.parentNode) {
            installBtn.style.opacity = '0';
            setTimeout(() => installBtn.remove(), 300);
        }
    }, 10000);
});
