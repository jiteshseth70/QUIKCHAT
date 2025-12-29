# QUIKCHAT Global - Random 1-on-1 Video Chat

A modern, real-time random video chat application that connects users from around the world.

## Features

- 🎥 **Random 1-on-1 Video Calls** - Connect instantly with random users
- 🌍 **Global Reach** - Chat with people from different countries
- 🔒 **Privacy Focused** - No registration required
- 💬 **Real-time Chat** - Text chat alongside video
- 📱 **Responsive Design** - Works on desktop and mobile
- 🎮 **Easy Controls** - Intuitive interface for everyone
- 🛡️ **Safety Features** - User reporting and moderation

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO, WebRTC
- **Database**: Firebase Firestore (optional)
- **Hosting**: Render (Free tier compatible)

## Setup Instructions

### 1. Prerequisites
- Node.js 16+ installed
- Firebase account (optional)
- Render account (for deployment)

### 2. Local Development

```bash
# Clone the repository
git clone <your-repo-url>
cd quikchat-global

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# For Firebase (optional)
# Download your Firebase service account key
# Save as firebase-service-account.json

# Start development server
npm run dev
