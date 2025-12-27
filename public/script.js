// Firebase Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global Variables
let socket;
let peerConnection;
let localStream;
let currentRoom = null;
let currentPartner = null;
let isModel = false;
let userFingerprint = null;
let userData = null;

// DOM Elements
const elements = {
    findPartnerBtn: document.getElementById('findPartnerBtn'),
    nextBtn: document.getElementById('nextBtn'),
    privateRequestBtn: document.getElementById('privateRequestBtn'),
    setupProfileBtn: document.getElementById('setupProfileBtn'),
    becomeModelBtn: document.getElementById('becomeModelBtn'),
    modelDashboardBtn: document.getElementById('modelDashboardBtn'),
    buyCoinsBtn: document.getElementById('buyCoinsBtn'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),
    activateModelBtn: document.getElementById('activateModelBtn'),
    proceedPaymentBtn: document.getElementById('proceedPaymentBtn'),
    
    yourVideo: document.getElementById('yourVideo'),
    partnerVideo: document.getElementById('partnerVideo'),
    partnerVideoWrapper: document.getElementById('partnerVideoWrapper'),
    startChatSection: document.getElementById('startChatSection'),
    chatBox: document.getElementById('chatBox'),
    
    userName: document.getElementById('userName'),
    userInfo: document.getElementById('userInfo'),
    userAvatar: document.getElementById('userAvatar'),
    onlineCount: document.getElementById('onlineCount'),
    userCoins: document.getElementById('userCoins'),
    
    setupModal: document.getElementById('setupModal'),
    modelModal: document.getElementById('modelModal'),
    paymentModal: document.getElementById('paymentModal')
};

// Initialize App
async function initApp() {
    // Get browser fingerprint
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    userFingerprint = result.visitorId;
    
    // Check if user exists in Firebase
    const userRef = database.ref('users/' + userFingerprint);
    userRef.once('value').then(snapshot => {
        if (snapshot.exists()) {
            // User exists - auto login
            userData = snapshot.val();
            updateUI();
            connectSocket();
        } else {
            // New user - show setup modal
            showModal('setupModal');
        }
    });
    
    // Initialize WebSocket connection
    connectSocket();
    
    // Request camera access
    await initCamera();
    
    // Setup event listeners
    setupEventListeners();
}

// Connect to Socket.IO server
function connectSocket() {
    // Update this with your Render server URL
    const serverUrl = 'https://your-render-app.onrender.com';
    socket = io(serverUrl, {
        transports: ['websocket']
    });
    
    socket.on('connect', () => {
        console.log('Connected to server');
        
        // Register user if data exists
        if (userData) {
            socket.emit('register-user', {
                fingerprint: userFingerprint,
                username: userData.username,
                age: userData.age,
                country: userData.country,
                bio: userData.bio,
                photo: userData.photo,
                gender: userData.gender,
                isModel: userData.isModel,
                perMinuteRate: userData.perMinuteRate
            });
        }
    });
    
    socket.on('user-registered', (data) => {
        userData = data;
        updateUI();
    });
    
    socket.on('online-count', (count) => {
        elements.onlineCount.textContent = `${count} Online`;
    });
    
    socket.on('match-found', async (data) => {
        currentRoom = data.roomId;
        currentPartner = data.user1.userId === userFingerprint ? data.user2 : data.user1;
        
        // Show video chat UI
        elements.startChatSection.style.display = 'none';
        elements.partnerVideoWrapper.style.display = 'block';
        elements.chatBox.style.display = 'block';
        
        // Update partner info
        updatePartnerInfo(currentPartner);
        
        // Initialize WebRTC
        await initWebRTC();
        
        // Show private button if partner is model
        if (currentPartner.isModel) {
            elements.privateRequestBtn.style.display = 'block';
            elements.privateRequestBtn.innerHTML = `<i class="fas fa-lock"></i> Private Chat (${currentPartner.perMinuteRate} coins/min)`;
        }
    });
    
    socket.on('webrtc-signal', async (data) => {
        if (peerConnection) {
            await peerConnection.signal(data.signal);
        }
    });
    
    socket.on('private-request', (data) => {
        showPrivateRequest(data);
    });
    
    socket.on('private-chat-started', (data) => {
        alert('Private chat started! Rate: ' + data.coinsPerMinute + ' coins/min');
        // Additional private chat logic here
    });
}

// Initialize Camera
async function initCamera() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        elements.yourVideo.srcObject = localStream;
    } catch (err) {
        console.error('Camera error:', err);
        alert('Camera/microphone access is required');
    }
}

// Initialize WebRTC
async function initWebRTC() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    };
    
    peerConnection = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: localStream,
        config: configuration
    });
    
    peerConnection.on('signal', (data) => {
        socket.emit('webrtc-signal', {
            to: currentPartner.socketId,
            signal: data
        });
    });
    
    peerConnection.on('stream', (stream) => {
        elements.partnerVideo.srcObject = stream;
    });
    
    peerConnection.on('connect', () => {
        console.log('WebRTC connected');
    });
    
    peerConnection.on('close', () => {
        console.log('WebRTC disconnected');
    });
}

// Update UI with user data
function updateUI() {
    if (userData) {
        elements.userName.textContent = userData.username;
        elements.userInfo.textContent = `${userData.age} • ${userData.country}`;
        elements.userCoins.textContent = `${userData.balance || 0} Coins`;
        
        // Update avatar if photo exists
        if (userData.photo) {
            elements.userAvatar.innerHTML = `<img src="${userData.photo}" alt="Avatar">`;
        }
        
        // Show model dashboard button if user is model
        if (userData.isModel) {
            elements.modelDashboardBtn.style.display = 'block';
            elements.becomeModelBtn.style.display = 'none';
        }
    }
}

// Update partner info display
function updatePartnerInfo(partner) {
    const partnerInfoDiv = document.getElementById('partnerInfo');
    partnerInfoDiv.innerHTML = `
        <h3>${partner.username}, ${partner.age}</h3>
        <p>${partner.country} • ${partner.bio || ''}</p>
        ${partner.isModel ? `<p><i class="fas fa-crown"></i> Model (${partner.perMinuteRate} coins/min)</p>` : ''}
    `;
}

// Show modal
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

// Hide modal
function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Setup event listeners
function setupEventListeners() {
    // Find partner button
    elements.findPartnerBtn.addEventListener('click', () => {
        const gender = document.getElementById('genderFilter').value;
        const country = document.getElementById('countryFilter').value;
        
        socket.emit('find-random-match', {
            gender: gender,
            country: country
        });
        
        elements.findPartnerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
        elements.findPartnerBtn.disabled = true;
    });
    
    // Next button
    elements.nextBtn.addEventListener('click', () => {
        if (peerConnection) {
            peerConnection.destroy();
            peerConnection = null;
        }
        
        elements.partnerVideoWrapper.style.display = 'none';
        elements.chatBox.style.display = 'none';
        elements.startChatSection.style.display = 'block';
        elements.findPartnerBtn.disabled = false;
        elements.findPartnerBtn.innerHTML = '<i class="fas fa-search"></i> Find Partner';
        
        currentRoom = null;
        currentPartner = null;
    });
    
    // Private request button
    elements.privateRequestBtn.addEventListener('click', () => {
        if (currentPartner && currentPartner.isModel) {
            socket.emit('request-private-chat', {
                toUserId: currentPartner.userId,
                coinsPerMinute: currentPartner.perMinuteRate
            });
            alert('Private chat request sent!');
        }
    });
    
    // Setup profile
    elements.saveProfileBtn.addEventListener('click', async () => {
        const userData = {
            fingerprint: userFingerprint,
            username: document.getElementById('inputName').value,
            age: document.getElementById('inputAge').value,
            gender: document.getElementById('inputGender').value,
            country: document.getElementById('inputCountry').value,
            bio: document.getElementById('inputBio').value,
            photo: '', // Handle photo upload separately
            isModel: false,
            perMinuteRate: 0,
            balance: 100, // Free starting coins
            earnings: 0
        };
        
        // Save to Firebase
        await database.ref('users/' + userFingerprint).set(userData);
        
        // Register with socket
        socket.emit('register-user', userData);
        
        hideModal('setupModal');
        updateUI();
    });
    
    // Become model
    elements.becomeModelBtn.addEventListener('click', () => {
        showModal('modelModal');
    });
    
    // Activate model
    elements.activateModelBtn.addEventListener('click', () => {
        const rate = document.querySelector('.rate-option.selected')?.dataset.rate || 10;
        
        userData.isModel = true;
        userData.perMinuteRate = parseInt(rate);
        
        database.ref('users/' + userFingerprint).update({
            isModel: true,
            perMinuteRate: parseInt(rate)
        });
        
        socket.emit('register-user', userData);
        
        hideModal('modelModal');
        updateUI();
        alert('Congratulations! You are now a model.');
    });
    
    // Buy coins
    elements.buyCoinsBtn.addEventListener('click', () => {
        showModal('paymentModal');
    });
    
    // Rate option selection
    document.querySelectorAll('.rate-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.rate-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
    
    // Coin pack selection
    document.querySelectorAll('.coin-pack').forEach(pack => {
        pack.addEventListener('click', () => {
            document.querySelectorAll('.coin-pack').forEach(p => p.classList.remove('selected'));
            pack.classList.add('selected');
        });
    });
    
    // Proceed to payment
    elements.proceedPaymentBtn.addEventListener('click', async () => {
        const amount = document.querySelector('.coin-pack.selected')?.dataset.amount;
        if (!amount) {
            alert('Please select a coin pack');
            return;
        }
        
        // Create payment order
        const response = await fetch('/api/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userFingerprint,
                amount: parseInt(amount)
            })
        });
        
        const order = await response.json();
        
        // Initialize Razorpay
        const options = {
            key: "YOUR_RAZORPAY_KEY",
            amount: order.amount,
            currency: "INR",
            name: "QuikChat Pro",
            description: "Coin Purchase",
            order_id: order.id,
            handler: async function(response) {
                alert('Payment successful! Coins added to your account.');
                hideModal('paymentModal');
                
                // Update user balance
                const coins = parseInt(amount);
                userData.balance = (userData.balance || 0) + coins;
                await database.ref('users/' + userFingerprint).update({
                    balance: userData.balance
                });
                updateUI();
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
    });
    
    // Model dashboard
    elements.modelDashboardBtn.addEventListener('click', () => {
        window.location.href = 'model-dashboard.html?fingerprint=' + userFingerprint;
    });
}

// Show private request notification
function showPrivateRequest(data) {
    if (confirm(`${data.fromUser.username} wants private chat (${data.coinsPerMinute} coins/min). Accept?`)) {
        socket.emit('accept-private-chat', {
            requestId: data.requestId,
            fromUserId: data.fromUser.userId,
            coinsPerMinute: data.coinsPerMinute
        });
    }
}

// Initialize app when page loads
window.addEventListener('DOMContentLoaded', initApp);

// Close modals when clicking outside
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});
