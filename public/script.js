/**
 * QUIKCHAT Global - Complete Fixed Version
 * Firebase Authentication + WebRTC + Socket.IO
 */

// Global Firebase instances
let auth = null;
let db = null;
let currentFirebaseUser = null;

// Initialize Firebase
try {
    if (firebase && firebase.apps.length) {
        auth = firebase.auth();
        db = firebase.firestore();
        console.log('✅ Firebase initialized');
    }
} catch (error) {
    console.log('⚠️ Firebase not available, running in local mode');
}

class QuikChatApp {
    constructor() {
        // Firebase instances
        this.auth = auth;
        this.db = db;
        this.firebaseUser = null;
        this.userId = null;
        this.idToken = null;
        
        // Socket and WebRTC
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.screenStream = null;
        this.currentCamera = 'user'; // 'user' or 'environment'
        
        // App state
        this.state = {
            isConnected: false,
            isCallActive: false,
            isMicOn: true,
            isCameraOn: true,
            isScreenSharing: false,
            isChatOpen: true,
            isRemoteVideoExpanded: false, // NEW: Track video size
            currentCallId: null,
            partner: null,
            userData: null,
            hasJoinedServer: false,
            isFindingPartner: false,
            settings: this.getDefaultSettings()
        };
        
        // DOM Elements cache
        this.elements = {};
        
        // Initialize
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadSavedData();
        this.initSocket();
        this.checkExistingUser();
    }

    cacheElements() {
        // Setup overlay
        this.elements.setupOverlay = document.getElementById('setupOverlay');
        this.elements.startChatBtn = document.getElementById('startChatBtn');
        this.elements.usernameInput = document.getElementById('username');
        this.elements.genderSelect = document.getElementById('gender');
        this.elements.countrySelect = document.getElementById('country');
        this.elements.languageSelect = document.getElementById('language');
        this.elements.termsCheckbox = document.getElementById('terms');

        // Main app
        this.elements.mainApp = document.getElementById('mainApp');
        this.elements.connectionStatus = document.getElementById('connectionStatus');
        this.elements.onlineCount = document.getElementById('onlineCount');
        this.elements.chatTimer = document.getElementById('chatTimer');
        this.elements.coinCount = document.getElementById('coinCount');

        // Video elements
        this.elements.localVideo = document.getElementById('localVideo');
        this.elements.remoteVideo = document.getElementById('remoteVideo');
        this.elements.remoteVideoContainer = document.getElementById('remoteVideoContainer');
        this.elements.localUsername = document.getElementById('localUsername');
        this.elements.remoteUsername = document.getElementById('remoteUsername');
        this.elements.remoteStatus = document.getElementById('remoteStatus');
        this.elements.remoteConnectionStatus = document.getElementById('remoteConnectionStatus');

        // Control buttons
        this.elements.micBtn = document.getElementById('micBtn');
        this.elements.cameraBtn = document.getElementById('cameraBtn');
        this.elements.micToggle = document.getElementById('micToggle');
        this.elements.cameraToggle = document.getElementById('cameraToggle');
        this.elements.flipCamera = document.getElementById('flipCamera');
        this.elements.screenShare = document.getElementById('screenShare');
        this.elements.disconnectBtn = document.getElementById('disconnectBtn');
        this.elements.nextBtn = document.getElementById('nextBtn');
        this.elements.nextPartnerBtn = document.getElementById('nextPartnerBtn');
        this.elements.reportBtn = document.getElementById('reportBtn');
        this.elements.fullscreenBtn = document.getElementById('fullscreenBtn');

        // Chat elements
        this.elements.chatSection = document.getElementById('chatSection');
        this.elements.chatMessages = document.getElementById('chatMessages');
        this.elements.messageInput = document.getElementById('messageInput');
        this.elements.sendMessageBtn = document.getElementById('sendMessageBtn');
        this.elements.chatToggle = document.getElementById('chatToggle');
        this.elements.closeChat = document.getElementById('closeChat');

        // Loading overlay
        this.elements.loadingOverlay = document.getElementById('loadingOverlay');
        this.elements.loadingText = document.getElementById('loadingText');
        this.elements.loadingSubtext = document.getElementById('loadingSubtext');
        this.elements.cancelSearch = document.getElementById('cancelSearch');
        this.elements.settingsModal = document.getElementById('settingsModal');

        // Settings
        this.elements.settingsBtn = document.getElementById('settingsBtn');
        this.elements.saveSettings = document.getElementById('saveSettings');
        this.elements.resetSettings = document.getElementById('resetSettings');
    }

    bindEvents() {
        // Setup form
        this.elements.startChatBtn.addEventListener('click', () => this.startSetup());
        
        // Call controls
        this.elements.micBtn.addEventListener('click', () => this.toggleMic());
        this.elements.cameraBtn.addEventListener('click', () => this.toggleCamera());
        this.elements.micToggle.addEventListener('click', () => this.toggleMic());
        this.elements.cameraToggle.addEventListener('click', () => this.toggleCamera());
        this.elements.flipCamera.addEventListener('click', () => this.flipCamera());
        this.elements.screenShare.addEventListener('click', () => this.toggleScreenShare());
        this.elements.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.elements.nextBtn.addEventListener('click', () => this.findNextPartner());
        this.elements.nextPartnerBtn.addEventListener('click', () => this.findNextPartner());
        this.elements.reportBtn.addEventListener('click', () => this.reportUser());
        this.elements.fullscreenBtn.addEventListener('click', () => this.toggleRemoteVideoSize());

        // Chat controls
        this.elements.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        this.elements.chatToggle.addEventListener('click', () => this.toggleChat());
        this.elements.closeChat.addEventListener('click', () => this.toggleChat());

        // Loading overlay
        this.elements.cancelSearch.addEventListener('click', () => this.cancelSearch());

        // Settings
        this.elements.settingsBtn.addEventListener('click', () => this.showSettings());
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings());
        this.elements.resetSettings.addEventListener('click', () => this.resetSettings());

        // File uploads
        document.getElementById('imageUpload').addEventListener('change', (e) => this.handleImageUpload(e));
        document.getElementById('fileUpload').addEventListener('change', (e) => this.handleFileUpload(e));
    }

    getDefaultSettings() {
        return {
            cameraQuality: 'auto',
            audioQuality: 'auto',
            enableChatSounds: true,
            autoNext: true,
            connectionType: 'auto'
        };
    }

    loadSavedData() {
        const savedUser = localStorage.getItem('quikchat_user');
        if (savedUser) {
            this.state.userData = JSON.parse(savedUser);
            this.elements.usernameInput.value = this.state.userData.username || '';
        }

        const savedSettings = localStorage.getItem('quikchat_settings');
        if (savedSettings) {
            this.state.settings = { ...this.getDefaultSettings(), ...JSON.parse(savedSettings) };
        }
    }

    checkExistingUser() {
        if (this.state.userData && this.state.userData.userId) {
            console.log('Found existing user, auto-connecting...');
            this.setupFirebaseUser();
        }
    }

    async startSetup() {
        const username = this.elements.usernameInput.value.trim();
        const gender = this.elements.genderSelect.value;
        const country = this.elements.countrySelect.value;
        const language = this.elements.languageSelect.value;
        const terms = this.elements.termsCheckbox.checked;

        if (!username || !gender || !country || !language || !terms) {
            this.showError('Please fill all fields and agree to terms');
            return;
        }

        try {
            this.showLoading('Creating your account...', 'Please wait');

            this.state.userData = {
                username,
                gender,
                country,
                language,
                coins: 150,
                totalChats: 0,
                totalTime: 0,
                createdAt: new Date().toISOString()
            };

            await this.setupFirebaseUser();
            this.saveUserData();
            await this.initMedia();
            this.showMainApp();
            this.joinChatServer();

        } catch (error) {
            console.error('Setup error:', error);
            this.showError('Failed to setup: ' + error.message);
            this.hideLoading();
        }
    }

    async setupFirebaseUser() {
        try {
            if (this.auth) {
                const userCredential = await this.auth.signInAnonymously();
                this.firebaseUser = userCredential.user;
                this.userId = this.firebaseUser.uid;
                this.idToken = await this.firebaseUser.getIdToken();
                
                if (this.state.userData) {
                    this.state.userData.userId = this.userId;
                    this.state.userData.isAnonymous = true;
                }

                if (this.db && this.state.userData) {
                    await this.db.collection('users').doc(this.userId).set({
                        ...this.state.userData,
                        lastSeen: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                }

                console.log('✅ Firebase user created:', this.userId);
                return true;
            }
        } catch (error) {
            console.warn('Firebase setup failed, using local mode:', error.message);
            this.userId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            if (this.state.userData) {
                this.state.userData.userId = this.userId;
                this.state.userData.isAnonymous = true;
            }
            return true;
        }
    }

    showMainApp() {
        this.elements.setupOverlay.classList.remove('active');
        this.elements.mainApp.classList.remove('hidden');
        
        if (this.state.userData) {
            this.elements.localUsername.textContent = this.state.userData.username;
            this.updateCoinCount(this.state.userData.coins);
        }
    }

    async initMedia() {
        try {
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.elements.localVideo.srcObject = this.localStream;
            
            this.elements.micBtn.classList.add('active');
            this.elements.cameraBtn.classList.add('active');
            this.elements.micToggle.classList.add('active');
            this.elements.cameraToggle.classList.add('active');
            
            console.log('✅ Media devices initialized');
            
        } catch (error) {
            console.error('❌ Media error:', error);
            this.showError('Camera/mic access required for video chat');
            this.state.isMicOn = false;
            this.state.isCameraOn = false;
        }
    }

    initSocket() {
        this.socket = io({
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        });

        this.socket.on('connect', () => {
            console.log('✅ Socket connected');
            this.state.isConnected = true;
            this.updateConnectionStatus('connected');
            
            if (this.state.userData && this.state.userData.userId) {
                this.joinChatServer();
            }
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Socket disconnected');
            this.state.isConnected = false;
            this.state.hasJoinedServer = false;
            this.updateConnectionStatus('disconnected');
        });

        this.socket.on('joined', (data) => {
            console.log('🎉 Joined server:', data);
            this.state.hasJoinedServer = true;
            this.hideLoading();
            
            if (data.userId && this.state.userData) {
                this.state.userData.userId = data.userId;
                this.saveUserData();
            }
            
            this.findPartner();
        });

        this.socket.on('status', (data) => {
            this.handleStatusUpdate(data);
        });

        this.socket.on('partner-found', (data) => {
            this.handlePartnerFound(data);
        });

        this.socket.on('webrtc-signal', (data) => {
            this.handleWebRTCSignal(data);
        });

        this.socket.on('receive-message', (data) => {
            this.handleReceiveMessage(data);
        });

        this.socket.on('partner-left', (data) => {
            this.handlePartnerLeft(data);
        });

        this.socket.on('partner-disconnected', (data) => {
            this.handlePartnerDisconnected(data);
        });

        this.socket.on('online-count', (data) => {
            this.updateOnlineCount(data.count);
        });

        this.socket.on('error', (data) => {
            console.error('❌ Socket error:', data);
            this.state.isFindingPartner = false;
            
            if (data.message === 'User not registered') {
                console.log('🔄 User not registered, trying to join...');
                this.state.hasJoinedServer = false;
                setTimeout(() => this.joinChatServer(), 1000);
            } else {
                this.showError(data.message);
            }
            
            this.hideLoading();
        });
    }

    joinChatServer() {
        if (!this.socket || !this.socket.connected) {
            console.log('Socket not ready, retrying...');
            setTimeout(() => this.joinChatServer(), 1000);
            return;
        }

        if (!this.state.userData || !this.state.userData.userId) {
            console.error('No user data available');
            return;
        }

        const joinData = {
            userId: this.state.userData.userId,
            username: this.state.userData.username,
            gender: this.state.userData.gender,
            country: this.state.userData.country,
            language: this.state.userData.language,
            isAnonymous: true,
            socketId: this.socket.id
        };

        if (this.idToken) {
            joinData.token = this.idToken;
        }

        console.log('📤 Joining server with:', joinData);
        this.socket.emit('join', joinData);
    }

    findPartner() {
        if (this.state.isFindingPartner) {
            return;
        }

        if (!this.state.hasJoinedServer) {
            console.log('Not joined to server yet');
            this.joinChatServer();
            return;
        }

        this.state.isFindingPartner = true;
        this.showLoading('Finding partner...', 'Searching worldwide');
        
        console.log('🔍 Finding partner...');
        this.socket.emit('find-partner', this.state.userData);
    }

    findNextPartner() {
        console.log('🔄 Finding next partner');
        
        if (this.state.isCallActive) {
            this.socket.emit('next-partner');
            this.resetCall();
        }
        
        setTimeout(() => {
            this.findPartner();
        }, 500);
    }

    cancelSearch() {
        this.hideLoading();
        this.state.isFindingPartner = false;
    }

    handleStatusUpdate(data) {
        switch (data.status) {
            case 'waiting':
                this.showLoading('Waiting for partner...', 
                    `Position: ${data.position || 1}\nEst. wait: ${data.estimatedWait || 10}s`);
                break;
            case 'finding-new-partner':
                this.showLoading('Finding new partner...', 'Searching for next user');
                break;
            case 'already-waiting':
                this.showLoading('Already in queue', 'Please wait for a partner');
                break;
        }
    }

    async handlePartnerFound(data) {
        console.log('✅ Partner found:', data);
        this.hideLoading();
        
        this.state.isCallActive = true;
        this.state.currentCallId = data.callId;
        this.state.partner = data.partner;
        this.state.isFindingPartner = false;
        
        this.elements.remoteUsername.textContent = data.partner?.username || 'Stranger';
        this.elements.remoteStatus.textContent = 'Connected';
        this.elements.remoteConnectionStatus.classList.add('hidden');
        
        await this.initWebRTC(data.callId, data.role);
        this.startChatTimer();
        this.addMessage('system', `Connected with ${data.partner.username}!`);
    }

    async initWebRTC(callId, role) {
        try {
            const configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            };

            this.peerConnection = new RTCPeerConnection(configuration);

            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }

            this.peerConnection.ontrack = (event) => {
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                    this.elements.remoteVideo.srcObject = this.remoteStream;
                }
                this.remoteStream.addTrack(event.track);
            };

            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('webrtc-signal', {
                        callId,
                        signal: event.candidate,
                        type: 'ice-candidate'
                    });
                }
            };

            if (role === 'caller') {
                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);
                
                this.socket.emit('webrtc-signal', {
                    callId,
                    signal: offer,
                    type: 'offer'
                });
            }

        } catch (error) {
            console.error('WebRTC error:', error);
            this.showError('Connection failed');
        }
    }

    async handleWebRTCSignal(data) {
        if (!this.peerConnection) return;

        try {
            switch (data.type) {
                case 'offer':
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);
                    
                    this.socket.emit('webrtc-signal', {
                        callId: data.callId,
                        signal: answer,
                        type: 'answer'
                    });
                    break;

                case 'answer':
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
                    break;

                case 'ice-candidate':
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.signal));
                    break;
            }
        } catch (error) {
            console.error('WebRTC signal error:', error);
        }
    }

    // ✅ FIXED: Toggle Mic Function
    toggleMic() {
        if (!this.localStream) return;
        
        this.state.isMicOn = !this.state.isMicOn;
        const audioTracks = this.localStream.getAudioTracks();
        
        audioTracks.forEach(track => {
            track.enabled = this.state.isMicOn;
        });
        
        // Update UI
        const isActive = this.state.isMicOn;
        this.elements.micBtn.classList.toggle('active', isActive);
        this.elements.micToggle.classList.toggle('active', isActive);
        
        if (this.elements.micBtn.querySelector('span')) {
            this.elements.micBtn.querySelector('span').textContent = isActive ? 'Mic On' : 'Mic Off';
        }
        
        this.addMessage('system', `Microphone ${isActive ? 'enabled' : 'disabled'}`);
    }

    // ✅ FIXED: Toggle Camera Function
    toggleCamera() {
        if (!this.localStream) return;
        
        this.state.isCameraOn = !this.state.isCameraOn;
        const videoTracks = this.localStream.getVideoTracks();
        
        videoTracks.forEach(track => {
            track.enabled = this.state.isCameraOn;
        });
        
        // Update UI
        const isActive = this.state.isCameraOn;
        this.elements.cameraBtn.classList.toggle('active', isActive);
        this.elements.cameraToggle.classList.toggle('active', isActive);
        
        if (this.elements.cameraBtn.querySelector('span')) {
            this.elements.cameraBtn.querySelector('span').textContent = isActive ? 'Camera On' : 'Camera Off';
        }
        
        this.addMessage('system', `Camera ${isActive ? 'enabled' : 'disabled'}`);
    }

    // ✅ FIXED: Flip Camera Function
    async flipCamera() {
        if (!this.localStream) return;
        
        try {
            this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
            
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: this.currentCamera
                }
            };
            
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Replace video track
            const newVideoTrack = newStream.getVideoTracks()[0];
            const oldVideoTrack = this.localStream.getVideoTracks()[0];
            
            if (oldVideoTrack) {
                oldVideoTrack.stop();
            }
            
            const sender = this.peerConnection?.getSenders().find(s => 
                s.track?.kind === 'video'
            );
            
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
            
            // Update local stream
            this.localStream.removeTrack(oldVideoTrack);
            this.localStream.addTrack(newVideoTrack);
            
            this.addMessage('system', `Switched to ${this.currentCamera === 'user' ? 'front' : 'rear'} camera`);
            
        } catch (error) {
            console.error('Flip camera error:', error);
            this.showError('Failed to flip camera');
        }
    }

    // ✅ FIXED: Toggle Screen Share
    async toggleScreenShare() {
        try {
            if (!this.state.isScreenSharing) {
                // Start screen sharing
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                });
                
                const screenTrack = this.screenStream.getVideoTracks()[0];
                const sender = this.peerConnection?.getSenders().find(s => 
                    s.track?.kind === 'video'
                );
                
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }
                
                // Stop camera track
                const cameraTrack = this.localStream.getVideoTracks()[0];
                cameraTrack.stop();
                
                this.state.isScreenSharing = true;
                this.elements.screenShare.classList.add('active');
                this.addMessage('system', 'Screen sharing started');
                
                // Handle when user stops sharing
                screenTrack.onended = () => {
                    this.toggleScreenShare();
                };
                
            } else {
                // Stop screen sharing, resume camera
                this.screenStream.getTracks().forEach(track => track.stop());
                
                const constraints = {
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: this.currentCamera
                    }
                };
                
                const newStream = await navigator.mediaDevices.getUserMedia(constraints);
                const newVideoTrack = newStream.getVideoTracks()[0];
                
                const sender = this.peerConnection?.getSenders().find(s => 
                    s.track?.kind === 'video'
                );
                
                if (sender) {
                    sender.replaceTrack(newVideoTrack);
                }
                
                // Update local stream
                const oldVideoTrack = this.localStream.getVideoTracks()[0];
                if (oldVideoTrack) {
                    this.localStream.removeTrack(oldVideoTrack);
                }
                this.localStream.addTrack(newVideoTrack);
                
                this.state.isScreenSharing = false;
                this.elements.screenShare.classList.remove('active');
                this.addMessage('system', 'Screen sharing stopped');
            }
            
        } catch (error) {
            console.error('Screen share error:', error);
            if (error.name !== 'NotAllowedError') {
                this.showError('Failed to share screen');
            }
        }
    }

    // ✅ FIXED: Toggle Remote Video Size (Fullscreen/Big Screen)
    toggleRemoteVideoSize() {
        this.state.isRemoteVideoExpanded = !this.state.isRemoteVideoExpanded;
        
        if (this.state.isRemoteVideoExpanded) {
            // Make remote video full size
            this.elements.remoteVideoContainer.classList.add('expanded');
            this.elements.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
            this.elements.fullscreenBtn.title = 'Minimize';
        } else {
            // Make remote video small (PIP)
            this.elements.remoteVideoContainer.classList.remove('expanded');
            this.elements.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            this.elements.fullscreenBtn.title = 'Fullscreen';
        }
        
        this.addMessage('system', 
            `Remote video ${this.state.isRemoteVideoExpanded ? 'expanded' : 'minimized'}`
        );
    }

    // ✅ FIXED: Send Message Function
    sendMessage(text = null) {
        const message = text || this.elements.messageInput.value.trim();
        
        if (!message || !this.state.currentCallId) return;
        
        const messageData = {
            callId: this.state.currentCallId,
            message: message,
            type: 'text'
        };
        
        this.socket.emit('send-message', messageData);
        
        // Add to local chat
        this.addMessage('own', message);
        
        // Clear input
        this.elements.messageInput.value = '';
        this.elements.messageInput.focus();
    }

    // ✅ FIXED: Add Message to Chat
    addMessage(type, content, sender = null) {
        const messagesContainer = this.elements.chatMessages;
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-bubble';
        
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        if (type === 'system') {
            messageDiv.className = 'message-bubble system';
            messageDiv.innerHTML = `
                <i class="fas fa-info-circle"></i>
                <div class="message-content">
                    <span>${content}</span>
                    <small>${timestamp}</small>
                </div>
            `;
        } else if (type === 'own') {
            messageDiv.className = 'message-bubble own';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <strong>You</strong>
                    <p>${content}</p>
                    <small>${timestamp}</small>
                </div>
            `;
        } else if (type === 'other') {
            messageDiv.className = 'message-bubble other';
            messageDiv.innerHTML = `
                <div class="message-content">
                    <strong>${sender || 'Partner'}</strong>
                    <p>${content}</p>
                    <small>${timestamp}</small>
                </div>
            `;
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Play sound if enabled
        if (this.state.settings.enableChatSounds && type !== 'own') {
            this.playNotificationSound();
        }
    }

    // ✅ FIXED: Handle Received Message
    handleReceiveMessage(data) {
        this.addMessage('other', data.message, data.senderName);
    }

    // ✅ FIXED: Handle Partner Left
    handlePartnerLeft(data) {
        this.addMessage('system', 'Partner left the chat');
        this.resetCall();
        this.findPartner();
    }

    // ✅ FIXED: Handle Partner Disconnected
    handlePartnerDisconnected(data) {
        this.addMessage('system', 'Partner disconnected');
        this.resetCall();
        
        if (this.state.settings.autoNext) {
            setTimeout(() => this.findPartner(), 2000);
        }
    }

    // ✅ FIXED: Disconnect Function
    disconnect() {
        if (confirm('Are you sure you want to disconnect?')) {
            if (this.state.currentCallId) {
                this.socket.emit('next-partner');
            }
            
            this.resetCall();
            
            if (this.socket && this.socket.connected) {
                this.socket.disconnect();
            }
            
            this.state.isConnected = false;
            this.updateConnectionStatus('disconnected');
            
            this.addMessage('system', 'You disconnected from the chat');
        }
    }

    // ✅ FIXED: Report User
    reportUser() {
        if (!this.state.partner) return;
        
        const reason = prompt('Please enter reason for reporting:', 
            'Inappropriate behavior');
        
        if (reason) {
            this.socket.emit('report-user', {
                reportedUserId: this.state.partner.userId,
                reason: reason,
                details: 'Reported from chat interface'
            });
            
            this.addMessage('system', `User reported: ${reason}`);
            alert('Thank you for your report. We will review it.');
            
            // Skip to next partner
            this.findNextPartner();
        }
    }

    // ✅ FIXED: Toggle Chat Panel
    toggleChat() {
        this.state.isChatOpen = !this.state.isChatOpen;
        
        if (window.innerWidth <= 1200) {
            // Mobile: Toggle with slide animation
            if (this.state.isChatOpen) {
                this.elements.chatSection.classList.add('active');
            } else {
                this.elements.chatSection.classList.remove('active');
            }
        } else {
            // Desktop: Toggle with flexbox
            if (this.state.isChatOpen) {
                this.elements.chatSection.style.display = 'flex';
            } else {
                this.elements.chatSection.style.display = 'none';
            }
        }
        
        this.elements.chatToggle.classList.toggle('active', this.state.isChatOpen);
    }

    // ✅ FIXED: Show Settings Modal
    showSettings() {
        this.elements.settingsModal.classList.remove('hidden');
        
        // Populate current settings
        document.getElementById('cameraQuality').value = this.state.settings.cameraQuality;
        document.getElementById('audioQuality').value = this.state.settings.audioQuality;
        document.getElementById('enableChatSounds').checked = this.state.settings.enableChatSounds;
        document.getElementById('autoNext').checked = this.state.settings.autoNext;
        document.getElementById('connectionType').value = this.state.settings.connectionType;
    }

    // ✅ FIXED: Save Settings
    saveSettings() {
        this.state.settings = {
            cameraQuality: document.getElementById('cameraQuality').value,
            audioQuality: document.getElementById('audioQuality').value,
            enableChatSounds: document.getElementById('enableChatSounds').checked,
            autoNext: document.getElementById('autoNext').checked,
            connectionType: document.getElementById('connectionType').value
        };
        
        localStorage.setItem('quikchat_settings', JSON.stringify(this.state.settings));
        this.elements.settingsModal.classList.add('hidden');
        this.addMessage('system', 'Settings saved successfully');
    }

    // ✅ FIXED: Reset Settings
    resetSettings() {
        if (confirm('Reset all settings to default?')) {
            this.state.settings = this.getDefaultSettings();
            localStorage.removeItem('quikchat_settings');
            this.addMessage('system', 'Settings reset to default');
            this.elements.settingsModal.classList.add('hidden');
        }
    }

    // ✅ FIXED: Handle Image Upload
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            this.showError('Please select an image file');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            this.showError('Image size should be less than 5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            
            img.onload = () => {
                this.addMessage('own', '📸 [Image Sent]');
                
                // In a real app, you would upload to server and send URL
                // For now, we'll just notify
                this.socket.emit('send-message', {
                    callId: this.state.currentCallId,
                    message: '📸 [Image]',
                    type: 'image'
                });
            };
        };
        
        reader.readAsDataURL(file);
        event.target.value = ''; // Clear input
    }

    // ✅ FIXED: Handle File Upload
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showError('File size should be less than 10MB');
            return;
        }
        
        this.addMessage('own', `📎 [File: ${file.name} - ${this.formatFileSize(file.size)}]`);
        
        // In a real app, you would upload to server and send URL
        this.socket.emit('send-message', {
            callId: this.state.currentCallId,
            message: `📎 [File: ${file.name}]`,
            type: 'file'
        });
        
        event.target.value = ''; // Clear input
    }

    // ✅ FIXED: Format File Size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ✅ FIXED: Play Notification Sound
    playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
            audio.volume = 0.3;
            audio.play().catch(e => console.log('Audio play failed:', e));
        } catch (error) {
            console.log('Notification sound error:', error);
        }
    }

    showLoading(title, subtitle) {
        this.elements.loadingText.textContent = title;
        this.elements.loadingSubtext.textContent = subtitle;
        this.elements.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.add('hidden');
        this.state.isFindingPartner = false;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        `;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--danger);
            color: white;
            padding: 12px 20px;
            border-radius: var(--radius-md);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => errorDiv.remove(), 300);
        }, 3000);
    }

    updateConnectionStatus(status) {
        const statusDot = this.elements.connectionStatus.querySelector('.status-dot');
        const statusText = this.elements.connectionStatus.querySelector('.status-text');
        
        switch (status) {
            case 'connected':
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Connected';
                break;
            case 'disconnected':
                statusDot.className = 'status-dot offline';
                statusText.textContent = 'Disconnected';
                break;
            case 'connecting':
                statusDot.className = 'status-dot connecting';
                statusText.textContent = 'Connecting...';
                break;
        }
    }

    updateOnlineCount(count) {
        this.elements.onlineCount.textContent = count;
    }

    updateCoinCount(coins) {
        this.elements.coinCount.textContent = coins;
    }

    startChatTimer() {
        this.chatStartTime = Date.now();
        this.chatTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.chatStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.elements.chatTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopChatTimer() {
        if (this.chatTimerInterval) {
            clearInterval(this.chatTimerInterval);
            this.chatTimerInterval = null;
        }
        this.elements.chatTimer.textContent = '0:00';
    }

    saveUserData() {
        if (this.state.userData) {
            localStorage.setItem('quikchat_user', JSON.stringify(this.state.userData));
        }
    }

    resetCall() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        
        if (this.elements.remoteVideo) {
            this.elements.remoteVideo.srcObject = null;
        }
        
        this.state.isCallActive = false;
        this.state.currentCallId = null;
        this.state.partner = null;
        this.state.isScreenSharing = false;
        this.state.isRemoteVideoExpanded = false;
        
        this.elements.remoteUsername.textContent = 'Finding partner...';
        this.elements.remoteStatus.textContent = 'Searching';
        this.elements.remoteConnectionStatus.classList.remove('hidden');
        this.elements.remoteVideoContainer.classList.remove('expanded');
        this.elements.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        
        this.stopChatTimer();
    }

    getCountryName(code) {
        const countries = {
            'IN': 'India', 'US': 'USA', 'GB': 'UK', 'CA': 'Canada',
            'AU': 'Australia', 'DE': 'Germany', 'FR': 'France',
            'JP': 'Japan', 'BR': 'Brazil', 'ES': 'Spain'
        };
        return countries[code] || code;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 QUIKCHAT Global starting...');
    window.quikChat = new QuikChatApp();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (window.quikChat) {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            window.quikChat.toggleMic();
        }
        
        if (e.code === 'KeyN' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            window.quikChat.findNextPartner();
        }
        
        if (e.code === 'Escape') {
            window.quikChat.disconnect();
        }
        
        if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            window.quikChat.toggleChat();
        }
        
        if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            window.quikChat.toggleRemoteVideoSize();
        }
    }
});

// Add animation keyframes to document
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
