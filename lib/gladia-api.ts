// Gladia API client for real-time transcription
export interface GladiaSessionResponse {
  id: string
  url: string
}

export interface GladiaTranscriptMessage {
  type: string
  session_id: string
  created_at: string
  data: {
    id: string
    utterance: {
      text: string
      start: number
      end: number
      language: string
      channel?: number
    }
    is_final: boolean
  }
}

export async function initializeGladiaSession(): Promise<GladiaSessionResponse> {
  try {
    // Get API key from environment variable with fallback
    const apiKey = process.env.NEXT_PUBLIC_GLADIA_API_KEY || "c2105b1e-db8c-4ba6-9361-bb00b1226e60"
    
    const response = await fetch("https://api.gladia.io/v2/live", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gladia-key": apiKey,
      },
      body: JSON.stringify({
        encoding: "wav/pcm",
        sample_rate: 16000,
        bit_depth: 16,
        channels: 1,
        // Specify English language only
        language_config: {
          languages: ["en"],
          code_switching: false,
        },
        messages_config: {
          receive_final_transcripts: true,
          receive_speech_events: true,
          receive_pre_processing_events: false,
          receive_realtime_processing_events: false,
          receive_post_processing_events: false,
          receive_acknowledgments: true,
          receive_errors: true,
          receive_lifecycle_events: true,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to initialize Gladia session: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error initializing Gladia session:", error)
    throw error
  }
}

export function isGladiaTranscriptMessage(message: any): message is GladiaTranscriptMessage {
  return (
    message &&
    message.type === "transcript" &&
    message.data &&
    message.data.utterance &&
    typeof message.data.utterance.text === "string"
  )
}
