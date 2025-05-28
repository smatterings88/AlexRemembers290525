# AlexListens - AI Voice Assistant

AlexListens is an advanced AI voice assistant that provides natural, empathetic conversations through real-time voice interaction. Built with Next.js, Firebase, and Ultravox, it offers a seamless conversational experience with smart memory capabilities.

## Features

- 🎙️ Real-time voice interaction
- 📝 Live conversation transcription
- 🧠 Smart memory system
- 🔐 Secure user authentication
- 💬 Persistent conversation history

## Tech Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Firebase, Ultravox
- **Authentication**: Firebase Auth
- **Database**: Firestore
- **Memory System**: Mem0

## Getting Started

1. Clone the repository
2. Create a `.env.local` file with required environment variables
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

The following environment variables are required:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
ULTRAVOX_API_KEY
AGENT_ID
MEM0_API_KEY
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@alexlistens.com