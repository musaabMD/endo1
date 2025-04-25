# Endo Clinic

A web application for the Endo Clinic to manage patient details and provide speech-to-text transcription for consultation notes.

## Features

- Patient list view
- Patient detail view
- Audio recording with real-time transcription
- Microphone permission handling
- Copy transcription to clipboard

## Technologies Used

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Vercel for deployment
- Gladia API for speech-to-text transcription

## Environment Variables

The application requires the following environment variables:

```
NEXT_PUBLIC_GLADIA_API_KEY=your_gladia_api_key
```

## Local Development

```bash
# Install dependencies
npm install --legacy-peer-deps

# Run the development server
npm run dev
```

## Deployment

This application is deployed on Vercel. To deploy your own version:

1. Fork the repository
2. Set up a new project on Vercel
3. Add the required environment variables
4. Deploy
