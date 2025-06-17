# D-ID Avatar Chatbot

An interactive AI chatbot featuring a realistic digital avatar powered by D-ID's streaming API and OpenAI's GPT-3.5.

## Features

- Real-time avatar video streaming using WebRTC
- Natural conversation with OpenAI GPT-3.5
- Synchronized avatar speech with AI responses
- Clean, modern web interface

## Prerequisites

- Node.js (v14 or higher)
- D-ID API key (get one at [D-ID Studio](https://studio.d-id.com))
- OpenAI API key (get one at [OpenAI Platform](https://platform.openai.com))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd d-id-chatbot
```

2. Install dependencies:
```bash
npm install
```

3. Set up your API keys:

   a. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   b. Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   c. Copy the API configuration example:
   ```bash
   cp api.json.example api.json
   ```
   
   d. Edit `api.json` and add your D-ID API key:
   ```json
   {
     "key": "your_d-id_api_key_here",
     "url": "https://api.d-id.com",
     "service": "talks"
   }
   ```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Click "Connect Avatar" to initialize the digital avatar

4. Type your message in the chat input and press Enter or click Send

5. The AI will respond and the avatar will speak the response

## Project Structure

- `server.js` - Express server with OpenAI integration
- `public/` - Frontend files
  - `index.html` - Main page
  - `app.js` - Frontend application logic
  - `style.css` - Styling
  - `streaming-client-api-fixed.js` - D-ID WebRTC client
- `api.json` - D-ID API configuration (gitignored)
- `.env` - Environment variables (gitignored)

## Security Notes

- Never commit `api.json` or `.env` files to version control
- Keep your API keys secure and rotate them regularly
- The `.gitignore` file is configured to exclude sensitive files

## Troubleshooting

- **Avatar appears black**: Ensure your browser allows autoplay for video elements
- **"Stream not ready" errors**: The avatar needs a few seconds to initialize after connecting
- **API errors**: Verify your API keys are correct and have sufficient credits

## License

This project is for demonstration purposes. Please refer to D-ID and OpenAI's terms of service for usage guidelines.