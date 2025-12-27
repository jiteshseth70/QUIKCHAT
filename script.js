/* ========== QUIKCHAT GLOBAL V2 - COMPLETE SCRIPT.JS ========== */
/* Version: 2.0.0 | Date: 2024 */

// ========== 1. GLOBAL VARIABLES & CONFIGURATION ==========
const config = {
    appName: 'QuikChat Global',
    version: '2.0.0',
    socketServer: 'https://your-socket-server.com',
    iceServers: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    },
    maxFileSize: 50 * 1024 * 1024, // 50MB
    reconnectAttempts: 5,
    reconnectDelay: 3000,
    chatHistoryLimit: 100
};

// Global state
const state = {
    currentUser: null,
    currentScreen: 'loading',
    currentChat: null,
    socket: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    mediaConstraints: {
        audio: true,
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
        }
    },
    isCallActive: false,
    isVideoEnabled: true,
    isAudioEnabled: true,
    isScreenSharing: false,
    isFullscreen: false,
    isChatOpen: false,
    isMenuOpen: false,
    messages: [],
    onlineUsers: [],
    notifications: [],
    settings: {
        theme: 'dark',
        language: 'en',
        notifications: true,
        sounds: true,
        vibration: true,
        autoAcceptCalls: false,
        videoQuality: '720p',
        audioQuality: 'high'
    }
};

// ========== 2. DOM ELEMENTS ==========
const elements = {
    // Screens
    screens: document.querySelectorAll('.screen'),
    loadingScreen: document.getElementById('loadingScreen'),
    homeScreen: document.getElementById('homeScreen'),
    registrationScreen: document.getElementById('registrationScreen'),
    videoChatScreen: document.getElementById('videoChatScreen'),
    textChatScreen: document.getElementById('textChatScreen'),
    settingsScreen: document.getElementById('settingsScreen'),

    // Loading Screen
    loadingProgress: document.getElementById('loadingProgress'),
    loadingTitle: document.getElementById('loadingTitle'),
    loadingMessage: document.getElementById('loadingMessage'),

    // Home Screen
    globalStats: document.querySelectorAll('.stat-value'),
    onlineCount: document.getElementById('onlineCount'),
    navCards: document.querySelectorAll('.nav-card'),
    actionButtons: document.querySelectorAll('.action-btn'),
    usersGrid: document.getElementById('usersGrid'),
    bottomNavItems: document.querySelectorAll('.nav-item'),

    // Registration Screen
    registrationForm: document.getElementById('registrationForm'),
    avatarInput: document.getElementById('avatarInput'),
    avatarPreview: document.getElementById('avatarPreview'),
    usernameInput: document.getElementById('username'),
    ageInput: document.getElementById('age'),
    genderOptions: document.querySelectorAll('.gender-option'),
    countryOptions: document.querySelectorAll('.country-option'),
    preferenceOptions: document.querySelectorAll('.pref-option'),
    bioTextarea: document.getElementById('bio'),
    bioCharCount: document.getElementById('bioCharCount'),
    termsCheckbox: document.getElementById('termsCheckbox'),
    privacyCheckbox: document.getElementById('privacyCheckbox'),

    // Video Chat Screen
    remoteVideo: document.getElementById('remoteVideo'),
    localVideo: document.getElementById('localVideo'),
    partnerName: document.getElementById('partnerName'),
    partnerCountry: document.getElementById('partnerCountry'),
    partnerGender: document.getElementById('partnerGender'),
    partnerAge: document.getElementById('partnerAge'),
    callTimer: document.getElementById('callTimer'),
    callQuality: document.getElementById('callQuality'),
    videoToggleBtn: document.getElementById('videoToggle'),
    audioToggleBtn: document.getElementById('audioToggle'),
    screenShareBtn: document.getElementById('screenShare'),
    fullscreenBtn: document.getElementById('fullscreen'),
    chatToggleBtn: document.getElementById('chatToggle'),
    endCallBtn: document.getElementById('endCall'),
    pipControlBtn: document.querySelector('.pip-control-btn'),

    // Chat Panel
    chatPanel: document.getElementById('chatPanel'),
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendMessageBtn: document.getElementById('sendMessage'),
    fileUploadBtn: document.getElementById('fileUpload'),
    emojiPickerBtn: document.getElementById('emojiPicker'),

    // Text Chat Screen
    chatPartnerInfo: document.querySelector('.chat-partner-info'),
    textChatMessages: document.getElementById('textChatMessages'),
    textMessageInput: document.getElementById('textMessageInput'),

    // Settings Screen
    settingsForm: document.getElementById('settingsForm'),
    themeSelect: document.getElementById('themeSelect'),
    languageSelect: document.getElementById('languageSelect'),
    notificationsToggle: document.getElementById('notificationsToggle'),
    soundsToggle: document.getElementById('soundsToggle'),
    vibrationToggle: document.getElementById('vibrationToggle'),
    autoAcceptToggle: document.getElementById('autoAcceptToggle'),
    videoQualitySelect: document.getElementById('videoQualitySelect'),
    audioQualitySelect: document.getElementById('audioQualitySelect'),
    clearDataBtn: document.getElementById('clearDataBtn'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Modals & Overlays
    modalOverlay: document.getElementById('modalOverlay'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    sideMenu: document.getElementById('sideMenu'),
    toastContainer: document.getElementById('toastContainer'),

    // Buttons
    menuToggleBtn: document.getElementById('menuToggle'),
    backButtons: document.querySelectorAll('.back-btn'),
    closeButtons: document.querySelectorAll('.close-btn'),
    modalCloseBtn: document.querySelector('.modal-close'),

    // Premium Elements
    premiumBadges: document.querySelectorAll('.premium-badge'),
    premiumButtons: document.querySelectorAll('.btn-premium')
};

// ========== 3. INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log(`${config.appName} v${config.version} initializing...`);
    
    // Initialize app
    initApp();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check for existing user session
    checkUserSession();
});

function initApp() {
    // Load settings from localStorage
    loadSettings();
    
    // Apply theme
    applyTheme();
    
    // Initialize Socket.IO
    initSocket();
    
    // Setup media devices
    setupMediaDevices();
    
    // Update UI
    updateUI();
}

function setupEventListeners() {
    // Navigation
    elements.navCards.forEach(card => {
        card.addEventListener('click', handleNavCardClick);
    });
    
    elements.actionButtons.forEach(btn => {
        btn.addEventListener('click', handleActionButtonClick);
    });
    
    elements.bottomNavItems.forEach(item => {
        item.addEventListener('click', handleBottomNavClick);
    });
    
    elements.backButtons.forEach(btn => {
        btn.addEventListener('click', handleBackButton);
    });
    
    elements.closeButtons.forEach(btn => {
        btn.addEventListener('click', handleCloseButton);
    });
    
    // Menu
    elements.menuToggleBtn?.addEventListener('click', toggleSideMenu);
    
    // Registration Form
    elements.registrationForm?.addEventListener('submit', handleRegistration);
    elements.avatarInput?.addEventListener('change', handleAvatarUpload);
    elements.bioTextarea?.addEventListener('input', updateBioCharCount);
    
    elements.genderOptions.forEach(option => {
        option.addEventListener('click', () => selectGender(option.dataset.gender));
    });
    
    elements.countryOptions.forEach(option => {
        option.addEventListener('click', () => selectCountry(option.dataset.country));
    });
    
    elements.preferenceOptions.forEach(option => {
        option.addEventListener('click', () => selectPreference(option.dataset.pref));
    });
    
    // Video Chat Controls
    elements.videoToggleBtn?.addEventListener('click', toggleVideo);
    elements.audioToggleBtn?.addEventListener('click', toggleAudio);
    elements.screenShareBtn?.addEventListener('click', toggleScreenShare);
    elements.fullscreenBtn?.addEventListener('click', toggleFullscreen);
    elements.chatToggleBtn?.addEventListener('click', toggleChatPanel);
    elements.endCallBtn?.addEventListener('click', endCall);
    elements.pipControlBtn?.addEventListener('click', togglePictureInPicture);
    
    // Chat
    elements.sendMessageBtn?.addEventListener('click', sendMessage);
    elements.messageInput?.addEventListener('keypress', handleMessageKeyPress);
    elements.fileUploadBtn?.addEventListener('change', handleFileUpload);
    
    // Settings
    elements.settingsForm?.addEventListener('change', saveSettings);
    elements.clearDataBtn?.addEventListener('click', clearAppData);
    elements.logoutBtn?.addEventListener('click', logout);
    
    // Window events
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ========== 4. SCREEN MANAGEMENT ==========
function switchScreen(screenName, data = {}) {
    // Hide all screens
    elements.screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(`${screenName}Screen`);
    if (targetScreen) {
        targetScreen.classList.add('active');
        state.currentScreen = screenName;
        
        // Execute screen-specific initialization
        switch(screenName) {
            case 'home':
                initHomeScreen();
                break;
            case 'videoChat':
                initVideoChatScreen(data);
                break;
            case 'textChat':
                initTextChatScreen(data);
                break;
            case 'settings':
                initSettingsScreen();
                break;
        }
        
        // Update bottom navigation
        updateBottomNav(screenName);
    }
}

function showLoadingOverlay(title = 'Loading...', message = 'Please wait') {
    if (elements.loadingTitle) elements.loadingTitle.textContent = title;
    if (elements.loadingMessage) elements.loadingMessage.textContent = message;
    elements.loadingOverlay.classList.add('active');
}

function hideLoadingOverlay() {
    elements.loadingOverlay.classList.remove('active');
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        elements.modalOverlay.classList.add('active');
    }
}

function hideModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    elements.modalOverlay.classList.remove('active');
}

function toggleSideMenu() {
    elements.sideMenu.classList.toggle('active');
    state.isMenuOpen = !state.isMenuOpen;
}

// ========== 5. USER MANAGEMENT ==========
function checkUserSession() {
    const userData = localStorage.getItem('quikchat_user');
    if (userData) {
        try {
            state.currentUser = JSON.parse(userData);
            switchScreen('home');
            showToast('Welcome back!', 'success');
        } catch (error) {
            console.error('Error parsing user data:', error);
            switchScreen('registration');
        }
    } else {
        switchScreen('registration');
    }
}

function handleRegistration(e) {
    e.preventDefault();
    
    if (!validateRegistrationForm()) {
        return;
    }
    
    const userData = {
        id: generateUserId(),
        username: elements.usernameInput.value.trim(),
        age: parseInt(elements.ageInput.value),
        gender: state.registrationData?.gender || 'other',
        country: state.registrationData?.country || 'unknown',
        preference: state.registrationData?.preference || 'both',
        bio: elements.bioTextarea.value.trim(),
        avatar: elements.avatarPreview.src || getDefaultAvatar(),
        createdAt: new Date().toISOString(),
        isPremium: false,
        lastSeen: new Date().toISOString()
    };
    
    // Save user data
    state.currentUser = userData;
    localStorage.setItem('quikchat_user', JSON.stringify(userData));
    
    // Connect to socket
    if (state.socket) {
        state.socket.emit('register', userData);
    }
    
    // Switch to home screen
    switchScreen('home');
    showToast('Registration successful!', 'success');
}

function validateRegistrationForm() {
    const errors = [];
    
    // Username validation
    const username = elements.usernameInput.value.trim();
    if (username.length < 3) {
        errors.push('Username must be at least 3 characters');
    }
    if (username.length > 20) {
        errors.push('Username must be less than 20 characters');
    }
    
    // Age validation
    const age = parseInt(elements.ageInput.value);
    if (age < 18) {
        errors.push('You must be at least 18 years old');
    }
    if (age > 100) {
        errors.push('Please enter a valid age');
    }
    
    // Terms validation
    if (!elements.termsCheckbox.checked) {
        errors.push('You must agree to the Terms of Service');
    }
    if (!elements.privacyCheckbox.checked) {
        errors.push('You must agree to the Privacy Policy');
    }
    
    // Display errors
    if (errors.length > 0) {
        showToast(errors[0], 'danger');
        return false;
    }
    
    return true;
}

function selectGender(gender) {
    elements.genderOptions.forEach(option => {
        option.classList.remove('active');
        if (option.dataset.gender === gender) {
            option.classList.add('active');
        }
    });
    state.registrationData = state.registrationData || {};
    state.registrationData.gender = gender;
}

function selectCountry(country) {
    elements.countryOptions.forEach(option => {
        option.classList.remove('active');
        if (option.dataset.country === country) {
            option.classList.add('active');
        }
    });
    state.registrationData = state.registrationData || {};
    state.registrationData.country = country;
}

function selectPreference(preference) {
    elements.preferenceOptions.forEach(option => {
        option.classList.remove('active');
        if (option.dataset.pref === preference) {
            option.classList.add('active');
        }
    });
    state.registrationData = state.registrationData || {};
    state.registrationData.preference = preference;
}

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'warning');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showToast('Image size should be less than 5MB', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        elements.avatarPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateBioCharCount() {
    const length = elements.bioTextarea.value.length;
    const maxLength = 500;
    elements.bioCharCount.textContent = `${length}/${maxLength}`;
    
    if (length > maxLength) {
        elements.bioCharCount.style.color = 'var(--danger-color)';
    } else if (length > maxLength * 0.8) {
        elements.bioCharCount.style.color = 'var(--warning-color)';
    } else {
        elements.bioCharCount.style.color = 'var(--text-secondary)';
    }
}

// ========== 6. SOCKET.IO COMMUNICATION ==========
function initSocket() {
    try {
        // Create socket connection
        state.socket = io(config.socketServer, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: config.reconnectAttempts,
            reconnectionDelay: config.reconnectDelay
        });
        
        // Socket event listeners
        state.socket.on('connect', handleSocketConnect);
        state.socket.on('disconnect', handleSocketDisconnect);
        state.socket.on('connect_error', handleSocketError);
        
        // User events
        state.socket.on('user:online', handleUserOnline);
        state.socket.on('user:offline', handleUserOffline);
        state.socket.on('user:updated', handleUserUpdated);
        state.socket.on('users:list', handleUsersList);
        
        // Chat events
        state.socket.on('chat:request', handleChatRequest);
        state.socket.on('chat:start', handleChatStart);
        state.socket.on('chat:message', handleChatMessage);
        state.socket.on('chat:end', handleChatEnd);
        state.socket.on('chat:typing', handleChatTyping);
        
        // Call events
        state.socket.on('call:request', handleCallRequest);
        state.socket.on('call:accept', handleCallAccept);
        state.socket.on('call:reject', handleCallReject);
        state.socket.on('call:offer', handleCallOffer);
        state.socket.on('call:answer', handleCallAnswer);
        state.socket.on('call:ice-candidate', handleIceCandidate);
        state.socket.on('call:end', handleCallEnd);
        
        // Notification events
        state.socket.on('notification', handleNotification);
        
        console.log('Socket.IO initialized');
    } catch (error) {
        console.error('Socket.IO initialization failed:', error);
        showToast('Connection error. Please refresh.', 'danger');
    }
}

function handleSocketConnect() {
    console.log('Socket connected:', state.socket.id);
    
    // Register user if logged in
    if (state.currentUser) {
        state.socket.emit('register', state.currentUser);
    }
    
    // Update connection status
    updateConnectionStatus('connected');
    showToast('Connected to server', 'success');
}

function handleSocketDisconnect(reason) {
    console.log('Socket disconnected:', reason);
    updateConnectionStatus('disconnected');
    
    if (reason === 'io server disconnect') {
        showToast('Disconnected from server', 'warning');
    }
}

function handleSocketError(error) {
    console.error('Socket error:', error);
    updateConnectionStatus('error');
    showToast('Connection error', 'danger');
}

// ========== 7. WEBRTC VIDEO/AUDIO CALLS ==========
async function startVideoChat(partnerId) {
    if (!state.socket || !state.socket.connected) {
        showToast('Not connected to server', 'danger');
        return;
    }
    
    showLoadingOverlay('Starting call', 'Connecting...');
    
    try {
        // Get local media stream
        state.localStream = await navigator.mediaDevices.getUserMedia(
            state.mediaConstraints
        );
        
        // Create peer connection
        state.peerConnection = new RTCPeerConnection(config.iceServers);
        
        // Add local stream to connection
        state.localStream.getTracks().forEach(track => {
            state.peerConnection.addTrack(track, state.localStream);
        });
        
        // Set up local video
        if (elements.localVideo) {
            elements.localVideo.srcObject = state.localStream;
        }
        
        // ICE candidate handling
        state.peerConnection.onicecandidate = event => {
            if (event.candidate) {
                state.socket.emit('call:ice-candidate', {
                    to: partnerId,
                    candidate: event.candidate
                });
            }
        };
        
        // Remote stream handling
        state.peerConnection.ontrack = event => {
            if (elements.remoteVideo && !state.remoteStream) {
                state.remoteStream = new MediaStream();
                state.remoteStream.addTrack(event.track);
                elements.remoteVideo.srcObject = state.remoteStream;
            }
        };
        
        // Connection state changes
        state.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', state.peerConnection.connectionState);
            
            switch(state.peerConnection.connectionState) {
                case 'connected':
                    hideLoadingOverlay();
                    state.isCallActive = true;
                    startCallTimer();
                    showToast('Call connected', 'success');
                    break;
                case 'disconnected':
                case 'failed':
                case 'closed':
                    endCall();
                    break;
            }
        };
        
        // Create and send offer
        const offer = await state.peerConnection.createOffer();
        await state.peerConnection.setLocalDescription(offer);
        
        // Send call request
        state.socket.emit('call:request', {
            to: partnerId,
            offer: offer,
            user: state.currentUser
        });
        
        // Switch to video chat screen
        switchScreen('videoChat', { partnerId: partnerId });
        
    } catch (error) {
        console.error('Error starting video chat:', error);
        hideLoadingOverlay();
        showToast('Failed to start call', 'danger');
        
        // Clean up
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
            state.localStream = null;
        }
    }
}

async function handleCallRequest(data) {
    const { from, offer, user } = data;
    
    // Show incoming call modal
    showIncomingCallModal(from, user);
    
    // Store offer for later
    state.pendingOffer = { from, offer, user };
}

async function acceptCall() {
    if (!state.pendingOffer) return;
    
    const { from, offer, user } = state.pendingOffer;
    
    showLoadingOverlay('Accepting call', 'Connecting...');
    
    try {
        // Get local media stream
        state.localStream = await navigator.mediaDevices.getUserMedia(
            state.mediaConstraints
        );
        
        // Create peer connection
        state.peerConnection = new RTCPeerConnection(config.iceServers);
        
        // Add local stream
        state.localStream.getTracks().forEach(track => {
            state.peerConnection.addTrack(track, state.localStream);
        });
        
        // Set up local video
        if (elements.localVideo) {
            elements.localVideo.srcObject = state.localStream;
        }
        
        // ICE candidate handling
        state.peerConnection.onicecandidate = event => {
            if (event.candidate) {
                state.socket.emit('call:ice-candidate', {
                    to: from,
                    candidate: event.candidate
                });
            }
        };
        
        // Remote stream handling
        state.peerConnection.ontrack = event => {
            if (elements.remoteVideo && !state.remoteStream) {
                state.remoteStream = new MediaStream();
                state.remoteStream.addTrack(event.track);
                elements.remoteVideo.srcObject = state.remoteStream;
            }
        };
        
        // Set remote description
        await state.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );
        
        // Create and send answer
        const answer = await state.peerConnection.createAnswer();
        await state.peerConnection.setLocalDescription(answer);
        
        // Send acceptance
        state.socket.emit('call:accept', {
            to: from,
            answer: answer
        });
        
        // Switch to video chat screen
        switchScreen('videoChat', { partnerId: from, partner: user });
        
        // Clear pending offer
        state.pendingOffer = null;
        
    } catch (error) {
        console.error('Error accepting call:', error);
        hideLoadingOverlay();
        showToast('Failed to accept call', 'danger');
        rejectCall();
    }
}

function rejectCall() {
    if (!state.pendingOffer) return;
    
    const { from } = state.pendingOffer;
    
    // Send rejection
    state.socket.emit('call:reject', { to: from });
    
    // Clear pending offer
    state.pendingOffer = null;
    hideModal();
}

async function handleCallOffer(data) {
    const { from, offer } = data;
    
    if (!state.peerConnection) return;
    
    try {
        await state.peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );
        
        const answer = await state.peerConnection.createAnswer();
        await state.peerConnection.setLocalDescription(answer);
        
        state.socket.emit('call:answer', {
            to: from,
            answer: answer
        });
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

async function handleCallAnswer(data) {
    const { answer } = data;
    
    if (!state.peerConnection) return;
    
    try {
        await state.peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
        );
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

async function handleIceCandidate(data) {
    const { candidate } = data;
    
    if (!state.peerConnection) return;
    
    try {
        await state.peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate)
        );
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
}

function endCall() {
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }
    
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        state.localStream = null;
    }
    
    if (state.remoteStream) {
        state.remoteStream = null;
    }
    
    // Stop call timer
    stopCallTimer();
    
    // Send call end signal
    if (state.socket && state.currentChat) {
        state.socket.emit('call:end', { to: state.currentChat.partnerId });
    }
    
    // Reset state
    state.isCallActive = false;
    state.isVideoEnabled = true;
    state.isAudioEnabled = true;
    state.isScreenSharing = false;
    state.currentChat = null;
    
    // Clear video elements
    if (elements.remoteVideo) elements.remoteVideo.srcObject = null;
    if (elements.localVideo) elements.localVideo.srcObject = null;
    
    // Switch back to home
    switchScreen('home');
    
    showToast('Call ended', 'info');
}

// ========== 8. MEDIA CONTROLS ==========
async function toggleVideo() {
    if (!state.localStream) return;
    
    const videoTrack = state.localStream.getVideoTracks()[0];
    if (videoTrack) {
        state.isVideoEnabled = !videoTrack.enabled;
        videoTrack.enabled = state.isVideoEnabled;
        
        // Update button state
        if (elements.videoToggleBtn) {
            elements.videoToggleBtn.classList.toggle('active', state.isVideoEnabled);
            elements.videoToggleBtn.innerHTML = state.isVideoEnabled ? 
                '<i class="fas fa-video"></i><span>Video On</span>' : 
                '<i class="fas fa-video-slash"></i><span>Video Off</span>';
        }
        
        // Send status update
        if (state.socket && state.currentChat) {
            state.socket.emit('call:video-toggle', {
                to: state.currentChat.partnerId,
                enabled: state.isVideoEnabled
            });
        }
    }
}

async function toggleAudio() {
    if (!state.localStream) return;
    
    const audioTrack = state.localStream.getAudioTracks()[0];
    if (audioTrack) {
        state.isAudioEnabled = !audioTrack.enabled;
        audioTrack.enabled = state.isAudioEnabled;
        
        // Update button state
        if (elements.audioToggleBtn) {
            elements.audioToggleBtn.classList.toggle('active', state.isAudioEnabled);
            elements.audioToggleBtn.innerHTML = state.isAudioEnabled ? 
                '<i class="fas fa-microphone"></i><span>Mic On</span>' : 
                '<i class="fas fa-microphone-slash"></i><span>Mic Off</span>';
        }
        
        // Send status update
        if (state.socket && state.currentChat) {
            state.socket.emit('call:audio-toggle', {
                to: state.currentChat.partnerId,
                enabled: state.isAudioEnabled
            });
        }
    }
}

async function toggleScreenShare() {
    try {
        if (!state.isScreenSharing) {
            // Start screen sharing
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });
            
            // Replace video track
            const videoTrack = screenStream.getVideoTracks()[0];
            const sender = state.peerConnection.getSenders().find(
                s => s.track?.kind === 'video'
            );
            
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }
            
            // Handle screen sharing stop
            videoTrack.onended = () => {
                toggleScreenShare();
            };
            
            state.isScreenSharing = true;
            elements.screenShareBtn.classList.add('active');
            elements.screenShareBtn.innerHTML = '<i class="fas fa-stop-circle"></i><span>Stop Share</span>';
            
        } else {
            // Stop screen sharing
            const videoTrack = state.localStream.getVideoTracks()[0];
            const sender = state.peerConnection.getSenders().find(
                s => s.track?.kind === 'video'
            );
            
            if (sender && videoTrack) {
                await sender.replaceTrack(videoTrack);
            }
            
            state.isScreenSharing = false;
            elements.screenShareBtn.classList.remove('active');
            elements.screenShareBtn.innerHTML = '<i class="fas fa-desktop"></i><span>Share Screen</span>';
        }
    } catch (error) {
        console.error('Error toggling screen share:', error);
        showToast('Failed to share screen', 'danger');
    }
}

function toggleFullscreen() {
    const videoContainer = elements.remoteVideo?.parentElement;
    
    if (!document.fullscreenElement) {
        if (videoContainer?.requestFullscreen) {
            videoContainer.requestFullscreen();
        }
        state.isFullscreen = true;
        elements.fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i><span>Exit Fullscreen</span>';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        state.isFullscreen = false;
        elements.fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i><span>Fullscreen</span>';
    }
}

async function togglePictureInPicture() {
    if (!elements.remoteVideo) return;
    
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            await elements.remoteVideo.requestPictureInPicture();
        }
    } catch (error) {
        console.error('Error toggling PiP:', error);
    }
}

// ========== 9. CHAT FUNCTIONALITY ==========
function toggleChatPanel() {
    elements.chatPanel.classList.toggle('active');
    state.isChatOpen = !state.isChatOpen;
    
    if (state.isChatOpen) {
        elements.chatToggleBtn.innerHTML = '<i class="fas fa-times"></i><span>Close Chat</span>';
        elements.messageInput?.focus();
    } else {
        elements.chatToggleBtn.innerHTML = '<i class="fas fa-comment"></i><span>Open Chat</span>';
    }
}

function sendMessage() {
    const message = elements.messageInput?.value.trim();
    if (!message || !state.currentChat) return;
    
    // Create message object
    const messageObj = {
        id: generateMessageId(),
        senderId: state.currentUser.id,
        receiverId: state.currentChat.partnerId,
        content: message,
        type: 'text',
        timestamp: new Date().toISOString(),
        status: 'sending'
    };
    
    // Add to local messages
    addMessageToChat(messageObj, 'sent');
    
    // Send via socket
    if (state.socket) {
        state.socket.emit('chat:message', {
            to: state.currentChat.partnerId,
            message: messageObj
        });
    }
    
    // Clear input
    elements.messageInput.value = '';
}

function handleChatMessage(data) {
    const { from, message } = data;
    
    // Add to chat
    addMessageToChat(message, 'received');
    
    // Show notification if chat not active
    if (state.currentScreen !== 'videoChat' || !state.isChatOpen) {
        showNotification('New message', message.content);
    }
}

function addMessageToChat(message, type) {
    const messageElement = createMessageElement(message, type);
    
    // Add to chat container
    if (elements.chatMessages) {
        elements.chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
    
    // Add to state
    state.messages.push(message);
    
    // Update message status
    if (type === 'sent' && state.socket) {
        message.status = 'sent';
        // You can also emit a delivery receipt here
    }
}

function createMessageElement(message, type) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    div.innerHTML = `
        <div class="message-content">${escapeHtml(message.content)}</div>
        <div class="message-time">${time}</div>
    `;
    
    return div;
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !state.currentChat) return;
    
    if (file.size > config.maxFileSize) {
        showToast('File size too large (max 50MB)', 'warning');
        return;
    }
    
    // Create file message
    const messageObj = {
        id: generateMessageId(),
        senderId: state.currentUser.id,
        receiverId: state.currentChat.partnerId,
        type: 'file',
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        fileType: file.type,
        timestamp: new Date().toISOString(),
        status: 'sending'
    };
    
    // Add to chat
    addMessageToChat(messageObj, 'sent');
    
    // Here you would typically upload to a server
    // For demo, we'll simulate upload
    simulateFileUpload(messageObj, file);
}

function simulateFileUpload(message, file) {
    setTimeout(() => {
        message.status = 'sent';
        message.fileUrl = URL.createObjectURL(file); // In real app, this would be server URL
        
        // Send via socket
        if (state.socket) {
            state.socket.emit('chat:file', {
                to: state.currentChat.partnerId,
                message: message
            });
        }
    }, 1000);
}

// ========== 10. SETTINGS MANAGEMENT ==========
function loadSettings() {
    const savedSettings = localStorage.getItem('quikchat_settings');
    if (savedSettings) {
        try {
            state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
            applySettings();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

function saveSettings() {
    // Update state from form
    state.settings.theme = elements.themeSelect?.value || 'dark';
    state.settings.language = elements.languageSelect?.value || 'en';
    state.settings.notifications = elements.notificationsToggle?.checked || true;
    state.settings.sounds = elements.soundsToggle?.checked || true;
    state.settings.vibration = elements.vibrationToggle?.checked || true;
    state.settings.autoAcceptCalls = elements.autoAcceptToggle?.checked || false;
    state.settings.videoQuality = elements.videoQualitySelect?.value || '720p';
    state.settings.audioQuality = elements.audioQualitySelect?.value || 'high';
    
    // Save to localStorage
    localStorage.setItem('quikchat_settings', JSON.stringify(state.settings));
    
    // Apply settings
    applySettings();
    
    showToast('Settings saved', 'success');
}

function applySettings() {
    // Apply theme
    applyTheme();
    
    // Apply language
    applyLanguage();
    
    // Update media constraints based on quality settings
    updateMediaConstraints();
}

function applyTheme() {
    document.body.setAttribute('data-theme', state.settings.theme);
    
    if (elements.themeSelect) {
        elements.themeSelect.value = state.settings.theme;
    }
}

function applyLanguage() {
    // This would typically load language files
    // For now, just update HTML lang attribute
    document.documentElement.lang = state.settings.language;
    
    if (elements.languageSelect) {
        elements.languageSelect.value = state.settings.language;
    }
}

function updateMediaConstraints() {
    switch(state.settings.videoQuality) {
        case '360p':
            state.mediaConstraints.video = { width: { ideal: 640 }, height: { ideal: 360 } };
            break;
        case '480p':
            state.mediaConstraints.video = { width: { ideal: 854 }, height: { ideal: 480 } };
            break;
        case '720p':
            state.mediaConstraints.video = { width: { ideal: 1280 }, height: { ideal: 720 } };
            break;
        case '1080p':
            state.mediaConstraints.video = { width: { ideal: 1920 }, height: { ideal: 1080 } };
            break;
    }
}

function clearAppData() {
    if (confirm('Are you sure you want to clear all app data? This cannot be undone.')) {
        localStorage.clear();
        sessionStorage.clear();
        
        // Reset state
        state.currentUser = null;
        state.messages = [];
        state.settings = {
            theme: 'dark',
            language: 'en',
            notifications: true,
            sounds: true,
            vibration: true,
            autoAcceptCalls: false,
            videoQuality: '720p',
            audioQuality: 'high'
        };
        
        // Reload app
        location.reload();
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // End current call if active
        if (state.isCallActive) {
            endCall();
        }
        
        // Disconnect socket
        if (state.socket) {
            state.socket.disconnect();
        }
        
        // Clear user data
        localStorage.removeItem('quikchat_user');
        
        // Reset state
        state.currentUser = null;
        
        // Switch to registration screen
        switchScreen('registration');
        
        showToast('Logged out successfully', 'info');
    }
}

// ========== 11. UTILITY FUNCTIONS ==========
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getDefaultAvatar() {
    const avatars = [
        '👤', '👨', '👩', '🧑', '👨‍💻', '👩‍💻', '👨‍🎨', '👩‍🎨', '👨‍🚀', '👩‍🚀'
    ];
    return avatars[Math.floor(Math.random() * avatars.length)];
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `status-dot ${status}`;
    }
}

function startCallTimer() {
    if (state.callTimerInterval) clearInterval(state.callTimerInterval);
    
    let seconds = 0;
    state.callTimerInterval = setInterval(() => {
        seconds++;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        const timeString = hours > 0 ?
            `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` :
            `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        if (elements.callTimer) {
            elements.callTimer.textContent = timeString;
        }
    }, 1000);
}

function stopCallTimer() {
    if (state.callTimerInterval) {
        clearInterval(state.callTimerInterval);
        state.callTimerInterval = null;
    }
}

// ========== 12. UI UPDATES & RENDER FUNCTIONS ==========
function updateUI() {
    // Update user info if logged in
    if (state.currentUser) {
        updateUserInfo();
    }
    
    // Update online users
    updateOnlineUsers();
    
    // Update notifications
    updateNotifications();
}

function updateUserInfo() {
    const userInfoElements = document.querySelectorAll('.user-info');
    userInfoElements.forEach(element => {
        const nameElement = element.querySelector('.user-name');
        if (nameElement) nameElement.textContent = state.currentUser.username;
        
        const avatarElement = element.querySelector('.user-avatar');
        if (avatarElement) {
            if (state.currentUser.avatar.startsWith('http') || state.currentUser.avatar.startsWith('data:')) {
                avatarElement.innerHTML = `<img src="${state.currentUser.avatar}" alt="${state.currentUser.username}">`;
            } else {
                avatarElement.textContent = state.currentUser.avatar;
            }
        }
    });
}

function updateOnlineUsers(users = []) {
    if (!elements.usersGrid) return;
    
    // Clear current users
    elements.usersGrid.innerHTML = '';
    
    // Add users
    users.forEach(user => {
        const userCard = createUserCard(user);
        elements.usersGrid.appendChild(userCard);
    });
}

function createUserCard(user) {
    const div = document.createElement('div');
    div.className = 'user-card';
    div.dataset.userId = user.id;
    
    div.innerHTML = `
        <div class="user-avatar avatar ${user.isPremium ? 'premium' : ''}">
            ${user.avatar && user.avatar.startsWith('http') || user.avatar.startsWith('data:') ?
                `<img src="${user.avatar}" alt="${user.username}">` :
                user.avatar || '👤'}
        </div>
        <div class="user-name">${escapeHtml(user.username)}</div>
        <div class="user-meta">
            <span class="user-age">${user.age || '?'}</span>
            <span class="user-gender gender-${user.gender || 'other'}">${getGenderIcon(user.gender)}</span>
        </div>
        <div class="user-country">
            <span class="flag">${getCountryFlag(user.country)}</span>
            <span>${getCountryName(user.country)}</span>
        </div>
    `;
    
    // Add click event
    div.addEventListener('click', () => startChatWithUser(user));
    
    return div;
}

function getGenderIcon(gender) {
    switch(gender) {
        case 'male': return '♂';
        case 'female': return '♀';
        default: return '⚧';
    }
}

function getCountryFlag(countryCode) {
    // This is a simplified version
    // In a real app, you'd use a proper flag library
    const flags = {
        'us': '🇺🇸', 'in': '🇮🇳', 'gb': '🇬🇧', 'ca': '🇨🇦',
        'au': '🇦🇺', 'de': '🇩🇪', 'fr': '🇫🇷', 'jp': '🇯🇵',
        'br': '🇧🇷', 'mx': '🇲🇽', 'ru': '🇷🇺', 'cn': '🇨🇳'
    };
    return flags[countryCode] || '🌐';
}

function getCountryName(countryCode) {
    const countries = {
        'us': 'USA', 'in': 'India', 'gb': 'UK', 'ca': 'Canada',
        'au': 'Australia', 'de': 'Germany', 'fr': 'France', 'jp': 'Japan',
        'br': 'Brazil', 'mx': 'Mexico', 'ru': 'Russia', 'cn': 'China'
    };
    return countries[countryCode] || 'Unknown';
}

function updateBottomNav(screen) {
    elements.bottomNavItems.forEach(item => {
        const targetScreen = item.dataset.target;
        item.classList.toggle('active', targetScreen === screen);
    });
}

// ========== 13. NOTIFICATION SYSTEM ==========
function showToast(message, type = 'info', duration = 3000) {
    if (!elements.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✓' :
                 type === 'danger' ? '✕' :
                 type === 'warning' ? '⚠' : 'ℹ';
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
    
    // Close on click
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    });
}

function showNotification(title, body, onClick = null) {
    // Check if notifications are allowed
    if (!state.settings.notifications || !('Notification' in window)) {
        return;
    }
    
    // Check permission
    if (Notification.permission === 'granted') {
        createNotification(title, body, onClick);
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                createNotification(title, body, onClick);
            }
        });
    }
}

function createNotification(title, body, onClick) {
    const notification = new Notification(title, {
        body: body,
        icon: '/favicon.ico'
    });
    
    if (onClick) {
        notification.onclick = onClick;
    }
    
    // Auto close after 5 seconds
    setTimeout(() => {
        notification.close();
    }, 5000);
}

function updateNotifications() {
    // Update badge count
    const unreadCount = state.notifications.filter(n => !n.read).length;
    const badgeElements = document.querySelectorAll('.notification-badge');
    
    badgeElements.forEach(badge => {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    });
}

// ========== 14. EVENT HANDLERS ==========
function handleNavCardClick(e) {
    const card = e.currentTarget;
    const action = card.dataset.action;
    
    switch(action) {
        case 'video-chat':
            // Show partner selection modal
            showModal('partnerSelectionModal');
            break;
        case 'text-chat':
            startRandomTextChat();
            break;
        case 'premium':
            showPremiumModal();
            break;
        case 'friends':
            showFriendsList();
            break;
    }
}

function handleActionButtonClick(e) {
    const button = e.currentTarget;
    const action = button.dataset.action;
    
    switch(action) {
        case 'profile':
            showProfileModal();
            break;
        case 'history':
            showChatHistory();
            break;
        case 'gifts':
            showGiftsShop();
            break;
        case 'settings':
            switchScreen('settings');
            break;
    }
}

function handleBottomNavClick(e) {
    const item = e.currentTarget;
    const targetScreen = item.dataset.target;
    
    if (targetScreen && targetScreen !== state.currentScreen) {
        switchScreen(targetScreen);
    }
}

function handleBackButton() {
    switch(state.currentScreen) {
        case 'videoChat':
        case 'textChat':
        case 'settings':
            switchScreen('home');
            break;
        case 'registration':
            // Already on registration, maybe go to home if logged in?
            if (state.currentUser) {
                switchScreen('home');
            }
            break;
    }
}

function handleCloseButton() {
    hideModal();
}

function handleMessageKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function handleResize() {
    // Update UI based on screen size
    if (window.innerWidth < 768) {
        document.body.classList.add('mobile');
        document.body.classList.remove('desktop');
    } else {
        document.body.classList.add('desktop');
        document.body.classList.remove('mobile');
    }
    
    // Adjust video layout for mobile
    if (state.currentScreen === 'videoChat' && window.innerHeight < 500) {
        // Compact mode for landscape
        document.querySelector('.video-chat-container').classList.add('compact');
    } else {
        document.querySelector('.video-chat-container')?.classList.remove('compact');
    }
}

function handleBeforeUnload(e) {
    if (state.isCallActive) {
        e.preventDefault();
        e.returnValue = 'You have an active call. Are you sure you want to leave?';
        return e.returnValue;
    }
}

function handleOnlineStatus() {
    const isOnline = navigator.onLine;
    updateConnectionStatus(isOnline ? 'connected' : 'disconnected');
    
    if (!isOnline) {
        showToast('You are offline', 'warning');
    } else {
        showToast('Back online', 'success');
        // Try to reconnect socket
        if (state.socket && !state.socket.connected) {
            state.socket.connect();
        }
    }
}

function handleKeyboardShortcuts(e) {
    // Don't trigger in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch(e.key) {
        case 'Escape':
            if (state.isChatOpen) {
                toggleChatPanel();
            } else if (state.isMenuOpen) {
                toggleSideMenu();
            } else if (document.querySelector('.modal.active')) {
                hideModal();
            }
            break;
        case ' ':
            if (state.currentScreen === 'videoChat') {
                e.preventDefault();
                toggleAudio();
            }
            break;
        case 'm':
            if (state.currentScreen === 'videoChat') {
                toggleAudio();
            }
            break;
        case 'v':
            if (state.currentScreen === 'videoChat') {
                toggleVideo();
            }
            break;
        case 'f':
            if (state.currentScreen === 'videoChat') {
                toggleFullscreen();
            }
            break;
    }
}

// ========== 15. PREMIUM FEATURES ==========
function showPremiumModal() {
    showModal('premiumModal');
}

function purchasePremium(plan = 'monthly') {
    showLoadingOverlay('Processing', 'Please wait...');
    
    // Simulate API call
    setTimeout(() => {
        hideLoadingOverlay();
        
        // Update user premium status
        if (state.currentUser) {
            state.currentUser.isPremium = true;
            state.currentUser.premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
            
            // Save to localStorage
            localStorage.setItem('quikchat_user', JSON.stringify(state.currentUser));
            
            // Update UI
            updateUserInfo();
            
            // Show success
            showToast('Premium activated successfully!', 'success');
            hideModal();
        }
    }, 1500);
}

// ========== 16. INITIALIZATION FUNCTIONS ==========
function initHomeScreen() {
    // Update stats
    updateGlobalStats();
    
    // Load online users
    if (state.socket) {
        state.socket.emit('users:list');
    }
    
    // Check for new notifications
    checkNotifications();
}

function initVideoChatScreen(data) {
    // Set partner info
    if (data.partner) {
        updatePartnerInfo(data.partner);
    }
    
    // Initialize chat
    if (elements.chatMessages) {
        elements.chatMessages.innerHTML = '';
    }
    
    // Reset messages
    state.messages = [];
    
    // Start connection timer
    startCallTimer();
}

function initTextChatScreen(data) {
    // Similar to video chat but for text only
    if (data.partner) {
        updatePartnerInfo(data.partner);
    }
}

function initSettingsScreen() {
    // Populate form with current settings
    if (elements.themeSelect) elements.themeSelect.value = state.settings.theme;
    if (elements.languageSelect) elements.languageSelect.value = state.settings.language;
    if (elements.notificationsToggle) elements.notificationsToggle.checked = state.settings.notifications;
    if (elements.soundsToggle) elements.soundsToggle.checked = state.settings.sounds;
    if (elements.vibrationToggle) elements.vibrationToggle.checked = state.settings.vibration;
    if (elements.autoAcceptToggle) elements.autoAcceptToggle.checked = state.settings.autoAcceptCalls;
    if (elements.videoQualitySelect) elements.videoQualitySelect.value = state.settings.videoQuality;
    if (elements.audioQualitySelect) elements.audioQualitySelect.value = state.settings.audioQuality;
}

function setupMediaDevices() {
    // Check for media devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Your browser does not support video/audio calls', 'warning');
        return;
    }
    
    // Request permissions
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            // Test audio
            stream.getTracks().forEach(track => track.stop());
        })
        .catch(error => {
            console.error('Error accessing media devices:', error);
            showToast('Please allow microphone access for calls', 'warning');
        });
}

// ========== 17. HELPER FUNCTIONS ==========
function updateGlobalStats() {
    // This would typically come from the server
    const stats = {
        online: Math.floor(Math.random() * 1000) + 500,
        active: Math.floor(Math.random() * 500) + 100,
        countries: Math.floor(Math.random() * 50) + 10
    };
    
    if (elements.globalStats && elements.globalStats.length >= 3) {
        elements.globalStats[0].textContent = stats.online.toLocaleString();
        elements.globalStats[1].textContent = stats.active.toLocaleString();
        elements.globalStats[2].textContent = stats.countries.toLocaleString();
    }
}

function updatePartnerInfo(partner) {
    if (elements.partnerName) elements.partnerName.textContent = partner.username;
    if (elements.partnerCountry) elements.partnerCountry.textContent = getCountryName(partner.country);
    if (elements.partnerGender) {
        elements.partnerGender.textContent = partner.gender || 'other';
        elements.partnerGender.className = `gender-icon ${partner.gender || 'other'}`;
    }
    if (elements.partnerAge) elements.partnerAge.textContent = partner.age || '?';
}

function startRandomTextChat() {
    if (!state.socket) return;
    
    showLoadingOverlay('Finding partner', 'Searching for available users...');
    
    state.socket.emit('chat:find-partner', {
        preferences: state.currentUser?.preference || 'both',
        country: state.currentUser?.country
    });
}

function startChatWithUser(user) {
    if (user.id === state.currentUser?.id) {
        showToast('You cannot chat with yourself', 'warning');
        return;
    }
    
    // Start text chat with selected user
    state.socket.emit('chat:request', {
        to: user.id,
        type: 'text'
    });
    
    showLoadingOverlay('Requesting chat', 'Sending request...');
}

function showIncomingCallModal(from, user) {
    const modal = document.getElementById('incomingCallModal');
    if (!modal) return;
    
    // Update modal with caller info
    modal.querySelector('.caller-name').textContent = user.username;
    modal.querySelector('.caller-country').textContent = getCountryName(user.country);
    
    // Set up buttons
    modal.querySelector('.accept-call').onclick = acceptCall;
    modal.querySelector('.reject-call').onclick = rejectCall;
    
    // Show modal
    showModal('incomingCallModal');
    
    // Play ringtone if enabled
    if (state.settings.sounds) {
        playRingtone();
    }
}

function playRingtone() {
    // Create and play audio element
    const audio = new Audio('path/to/ringtone.mp3');
    audio.loop = true;
    audio.play().catch(() => {
        console.log('Audio play failed (user gesture required)');
    });
    
    // Store reference to stop later
    state.ringtoneAudio = audio;
}

function stopRingtone() {
    if (state.ringtoneAudio) {
        state.ringtoneAudio.pause();
        state.ringtoneAudio.currentTime = 0;
        state.ringtoneAudio = null;
    }
}

function checkNotifications() {
    // Check for new messages, friend requests, etc.
    // This would typically poll the server or use WebSocket
}

// ========== 18. SOCKET EVENT HANDLERS ==========
function handleUserOnline(data) {
    const { user } = data;
    
    // Add to online users list
    const existingIndex = state.onlineUsers.findIndex(u => u.id === user.id);
    if (existingIndex === -1) {
        state.onlineUsers.push(user);
        updateOnlineUsers(state.onlineUsers);
    }
    
    // Update online count
    if (elements.onlineCount) {
        elements.onlineCount.textContent = state.onlineUsers.length;
    }
}

function handleUserOffline(data) {
    const { userId } = data;
    
    // Remove from online users
    state.onlineUsers = state.onlineUsers.filter(u => u.id !== userId);
    updateOnlineUsers(state.onlineUsers);
    
    // Update online count
    if (elements.onlineCount) {
        elements.onlineCount.textContent = state.onlineUsers.length;
    }
}

function handleUsersList(data) {
    const { users } = data;
    state.onlineUsers = users;
    updateOnlineUsers(users);
    
    if (elements.onlineCount) {
        elements.onlineCount.textContent = users.length;
    }
}

function handleChatRequest(data) {
    const { from, user, type } = data;
    
    if (type === 'video') {
        // Store for incoming call
        state.pendingCall = { from, user };
        showIncomingCallModal(from, user);
    } else {
        // Text chat request
        showIncomingChatRequest(from, user);
    }
}

function handleChatStart(data) {
    const { partner, type } = data;
    
    hideLoadingOverlay();
    
    if (type === 'video') {
        state.currentChat = { partnerId: partner.id, type: 'video' };
        startVideoChat(partner.id);
    } else {
        state.currentChat = { partnerId: partner.id, type: 'text' };
        switchScreen('textChat', { partner: partner });
    }
}

function handleChatEnd(data) {
    const { reason } = data;
    
    if (state.isCallActive) {
        endCall();
    }
    
    showToast(`Chat ended: ${reason}`, 'info');
    switchScreen('home');
}

function handleChatTyping(data) {
    const { from, isTyping } = data;
    
    if (state.currentChat && state.currentChat.partnerId === from) {
        // Show typing indicator
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = isTyping ? 'block' : 'none';
        }
    }
}

function handleCallEnd(data) {
    const { reason } = data;
    
    if (state.isCallActive) {
        endCall();
        showToast(`Call ended: ${reason}`, 'info');
    }
}

function handleNotification(data) {
    const { type, message, data: notifData } = data;
    
    // Add to notifications
    state.notifications.unshift({
        id: Date.now(),
        type,
        message,
        data: notifData,
        read: false,
        timestamp: new Date().toISOString()
    });
    
    // Show toast
    showToast(message, type);
    
    // Show system notification
    if (state.settings.notifications) {
        showNotification('QuikChat', message);
    }
    
    // Update notification badge
    updateNotifications();
}

// ========== 19. ERROR HANDLING ==========
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let userMessage = 'An error occurred';
    
    if (error.name === 'NotAllowedError') {
        userMessage = 'Please allow camera/microphone access';
    } else if (error.name === 'NotFoundError') {
        userMessage = 'Camera/microphone not found';
    } else if (error.name === 'NotReadableError') {
        userMessage = 'Camera/microphone is in use by another application';
    } else if (error.name === 'OverconstrainedError') {
        userMessage = 'Camera constraints cannot be satisfied';
    } else if (error.name === 'SecurityError') {
        userMessage = 'Camera/microphone access blocked by security settings';
    } else if (error.name === 'TypeError') {
        userMessage = 'Invalid parameters';
    }
    
    showToast(userMessage, 'danger');
    
    // Log to server if available
    if (state.socket) {
        state.socket.emit('error:client', {
            context,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
}

// ========== 20. CLEANUP & DESTRUCTOR ==========
function cleanup() {
    // Stop all media tracks
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
    }
    
    if (state.remoteStream) {
        state.remoteStream.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (state.peerConnection) {
        state.peerConnection.close();
    }
    
    // Clear intervals
    if (state.callTimerInterval) {
        clearInterval(state.callTimerInterval);
    }
    
    // Disconnect socket
    if (state.socket) {
        state.socket.disconnect();
    }
    
    // Stop ringtone
    stopRingtone();
    
    console.log('App cleanup completed');
}

// Register cleanup for page unload
window.addEventListener('beforeunload', cleanup);

// ========== 21. SERVICE WORKER REGISTRATION ==========
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// ========== 22. PWA INSTALL PROMPT ==========
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show install button
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'block';
        installBtn.addEventListener('click', () => {
            // Show the prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
            });
        });
    }
});

// ========== END OF SCRIPT.JS ==========
