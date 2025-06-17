# HeyGen Trial Mode Setup Guide

## How to Use Trial Mode (No API Key Required!)

### Step 1: Get a Trial Token
1. Go to https://app.heygen.com/streaming-avatar
2. Click the "Try Now" button
3. You'll receive a trial token (looks like: `eyJhbGciOiJIUzI1NiIsInR...`)
4. Copy the entire token

### Step 2: Start the Server
```bash
node server-trial.js
```

### Step 3: Use the App
1. Open http://localhost:3000 in your browser
2. Paste your trial token in the input field
3. Click "Start Session"
4. Wait for the avatar to appear
5. Start chatting!

## What's Different in Trial Mode?

**Trial Mode:**
- ✅ No API key required
- ✅ Free to test
- ✅ Get tokens from HeyGen website
- ⚠️ Tokens are one-time use
- ⚠️ Limited to 3 concurrent sessions

**Enterprise Mode:**
- Requires paid API key
- Unlimited tokens
- Higher quality avatars
- More concurrent sessions

## How It Works

1. **Frontend** gets trial token from user
2. **Frontend** uses HeyGen SDK directly with token
3. **Backend** handles OpenAI chat responses
4. **Frontend** makes avatar speak the responses

## Troubleshooting

**Token not working?**
- Make sure you copied the entire token
- Tokens expire after one use
- Get a fresh token from HeyGen

**Avatar not appearing?**
- Check browser console for errors
- Ensure WebRTC is allowed in your browser
- Try Chrome or Edge browsers

**No chat responses?**
- Check that OpenAI API key is set in .env
- Look at server console for errors

## File Structure for Trial Mode
- `server-trial.js` - Backend server for trial mode
- `public/trial.html` - Frontend that uses SDK directly
- `heygen-trial-service.js` - Simple session management