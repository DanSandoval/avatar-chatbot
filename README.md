# Avatar Chatbot Demo

A real-time talking avatar chatbot using HeyGen Interactive Avatar API and OpenAI Realtime API.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API keys in `.env`:**
   ```
   HEYGEN_API_KEY=your_heygen_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   - Get HeyGen API key from: https://app.heygen.com/settings?nav=API
   - Get OpenAI API key from: https://platform.openai.com/api-keys

3. **Test API access:**
   ```bash
   node test-apis.js
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open browser:**
   - Navigate to http://localhost:3000
   - Click "Start Avatar Session"
   - Begin chatting!

## Architecture

- **Backend:** Express.js server handling API connections
- **HeyGen:** WebRTC video streaming for avatar
- **OpenAI:** WebSocket for real-time GPT responses
- **Frontend:** Simple HTML/JS interface

## API Usage

- HeyGen credits: 1 credit = 5 minutes streaming
- OpenAI: Standard GPT-4o token pricing

## Troubleshooting

- **HeyGen 401 error:** 
  - Verify API key from https://app.heygen.com/settings?nav=API
  - Ensure you have an Enterprise account (API keys are for Enterprise only)
  - For trial users, you may need to use the SDK directly instead of API
  - Check if API key has expired or needs regeneration
- **Avatar not appearing:** Check browser allows WebRTC
- **No response:** Check OpenAI API key and quota

## Current Status

- ✅ OpenAI Realtime API: Working
- ❌ HeyGen API: Authentication issue (401 Unauthorized)
  - The provided API key appears to be invalid or expired
  - You'll need a valid HeyGen Enterprise API key to proceed

## Running Without HeyGen

The server will still start and you can test the OpenAI integration:
1. Start server: `npm start`
2. The chat WebSocket will work but avatar creation will fail
3. You'll see GPT responses in the console