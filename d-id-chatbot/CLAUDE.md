# D-ID Avatar Chatbot Project

## Project Overview
This is a web-based chatbot application that uses D-ID's Live Streaming API to create a talking avatar (Dr. Henry Grant, a paleontologist) that responds to user messages using OpenAI's GPT-4 model.

## Project Directory
```
/mnt/c/Users/Dan/avatar-chatbot/d-id-chatbot
```

## Key Dependencies & Requirements

### 1. API Keys (Required)
- **D-ID API Key**: Must be configured in `api.json` - get from https://studio.d-id.com/account-settings
- **OpenAI API Key**: Must be set in `.env` file as `OPENAI_API_KEY`
- **ngrok**: For public URL if testing custom avatars (optional)

### 2. Server Setup
```bash
npm install
node server.js
```
Server runs on http://localhost:3000

### 3. Critical Files

#### `api.json` - D-ID Configuration
```json
{
  "key": "YOUR_D-ID_API_KEY_HERE",
  "url": "https://api.d-id.com",
  "service": "talks",
  "websocketUrl": "wss://notifications.d-id.com"
}
```

#### `.env` - OpenAI Configuration
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Known Issues & Important Notes

### Session ID Issue (D-ID API Bug)
- **Problem**: D-ID API is returning AWS load balancer cookies in the session_id field instead of a proper session ID
- **Root Cause**: This appears to be a bug on D-ID's side where their API response includes cookie data in the session_id field
- **Error**: API returns "missing or invalid session_id" when the cookie-formatted session_id is used
- **Current Workaround**: Extract the cookie value (part after AWSALB= and before first semicolon) and use that as session_id
- **Status**: Partial workaround - initial requests work but subsequent requests may still fail after ~30 seconds

## Other Known Issues

### 1. Custom Avatar Images
- **Current Status**: Custom images (Dr. Grant) fail with 500 errors from D-ID
- **Working Solution**: Using D-ID's default presenter: `https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/thumbnail.jpeg`
- **Requirements for Custom Images** (per D-ID):
  - Must have clear, detectable human face
  - Front-facing perspective
  - Good lighting and resolution
  - Hosted on accessible URL
  - D-ID may block certain domains (Imgur confirmed not working)

### 2. Authentication
- D-ID uses Basic Authentication with the API key directly (not base64 encoded)
- Format: `Authorization: Basic YOUR_API_KEY`
- Note: Despite "Basic" auth typically requiring base64, D-ID expects the raw API key

### 3. Current Avatar Configuration
Located in `public/avatar-config.js`:
```javascript
source_url: "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/thumbnail.jpeg"
```

### 4. WebRTC Connection
- Uses WebRTC for real-time video streaming
- Requires HTTPS in production
- Local development works with HTTP

## Architecture Overview

1. **Frontend** (`public/`):
   - `app.js` - Main application logic
   - `streaming-client-api-fixed.js` - D-ID WebRTC client
   - `avatar-config.js` - Avatar configuration
   - `index.html` - UI
   - `style-modern.css` - Styling

2. **Backend** (`server.js`):
   - Express server
   - Proxy endpoint for D-ID API (`/api/streams/create`)
   - OpenAI chat endpoint (`/api/chat`)
   - Serves static files and API configuration

3. **Communication Flow**:
   ```
   User → Frontend → Server → D-ID API (for avatar)
                   ↘ Server → OpenAI API (for responses)
   ```

## Common Tasks

### Change Avatar Image
Edit `public/avatar-config.js`:
```javascript
source_url: "YOUR_IMAGE_URL_HERE"
```

### Update AI Personality
Edit the system prompt in `server.js` line 57

### Test Connection
1. Start server: `node server.js`
2. Open browser: http://localhost:3000
3. Click "Start Call"
4. Type a message

## Debugging Tips

1. **Check Server Console** for:
   - "Stream creation request" logs
   - "D-ID API error" messages
   - API key presence confirmation

2. **Check Browser Console** for:
   - WebRTC connection states
   - Stream ready events
   - Authorization errors

3. **Common Errors**:
   - 500 Error: Usually means D-ID can't process the image
   - 401 Error: API key issue
   - CORS Error: Make sure using proxy endpoint

## Future Improvements
1. Implement proper error handling for custom images
2. Add image validation before sending to D-ID
3. Create UI for selecting different avatars
4. Add reconnection logic for dropped connections
5. Implement session management

## Contact & Resources
- D-ID Docs: https://docs.d-id.com/reference/talks-streams-overview
- D-ID Support: For custom image requirements
- OpenAI Docs: https://platform.openai.com/docs

---
Last Updated: July 2024
Current Status: Working with D-ID default avatar, custom images need resolution