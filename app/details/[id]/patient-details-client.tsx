"use client"

import { useState, useEffect, useRef } from "react"
import { Mic, Copy, X, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { initializeGladiaSession, isGladiaTranscriptMessage } from "@/lib/gladia-api"

// Define the patient type
interface Patient {
  id: string
  name: string
  diagnosis: string
  date: string
}

// This is a client component that receives props from the server component
export default function PatientDetailsClient({
  patientId,
  patient
}: {
  patientId: string
  patient: Patient | undefined
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedText, setRecordedText] = useState("")
  const [liveTranscription, setLiveTranscription] = useState("")
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioURL, setAudioURL] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [permissionGranted, setPermissionGranted] = useState(true)

  const webSocketRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Copy text to clipboard
  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(recordedText)
      .then(() => {
        alert("Text copied to clipboard!")
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err)
      })
  }

  // Check microphone permissions on component mount
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // If successful, we have permission
        stream.getTracks().forEach(track => track.stop()) // Clean up the test stream
        setPermissionGranted(true)
      } catch (err) {
        console.error("Error accessing microphone:", err)
        setPermissionGranted(false)
        setError("Microphone access is required. Please enable microphone permissions in your browser settings.")
      }
    }
    
    checkMicrophonePermission()
  }, [])

  // Start recording audio with Gladia API
  const startRecording = async () => {
    try {
      setError(null)
      setLiveTranscription("")

      // Initialize Gladia session
      const gladiaSession = await initializeGladiaSession()

      // Connect to WebSocket
      const socket = new WebSocket(gladiaSession.url)
      webSocketRef.current = socket

      socket.addEventListener("open", async () => {
        console.log("WebSocket connection established")

        try {
          // Get audio stream
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          streamRef.current = stream

          // Create audio context and processor
          const audioContext = new AudioContext({ sampleRate: 16000 })
          audioContextRef.current = audioContext

          const source = audioContext.createMediaStreamSource(stream)
          const processor = audioContext.createScriptProcessor(4096, 1, 1)
          processorNodeRef.current = processor

          // Process audio data
          processor.onaudioprocess = (e) => {
            if (socket.readyState === WebSocket.OPEN) {
              const inputData = e.inputBuffer.getChannelData(0)
              const pcmData = convertFloat32ToInt16(inputData)
              socket.send(pcmData)
            }
          }

          source.connect(processor)
          processor.connect(audioContext.destination)

          // Create MediaRecorder for audio playback
          const recorder = new MediaRecorder(stream)
          const audioChunks: BlobPart[] = []

          recorder.addEventListener("dataavailable", (event) => {
            audioChunks.push(event.data)
          })

          recorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/mp3" })
            const audioUrl = URL.createObjectURL(audioBlob)
            setAudioURL(audioUrl)
          })

          recorder.start()
          setMediaRecorder(recorder)
          setIsRecording(true)
        } catch (err) {
          console.error("Error accessing microphone:", err)
          if (err instanceof DOMException && err.name === 'NotAllowedError') {
            setError("Microphone access denied. Please check your browser settings and ensure microphone permissions are enabled.")
            setPermissionGranted(false)
          } else {
            setError("Failed to access microphone. Please check your permissions.")
          }
          socket.close()
        }
      })

      // Handle WebSocket messages
      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data)

          if (isGladiaTranscriptMessage(message)) {
            // Only process if the language is English
            if (message.data.utterance.language === "en") {
              const transcriptText = message.data.utterance.text
              setLiveTranscription(transcriptText)

              if (message.data.is_final) {
                setRecordedText((prev) => {
                  // If there's existing text, add appropriate punctuation before the new segment
                  if (prev) {
                    // Check if the previous text already ends with punctuation
                    const endsWithPunctuation = /[.,:;—]$/.test(prev.trim())
                    // Add a semicolon and space if no punctuation, otherwise just add a space
                    return endsWithPunctuation ? `${prev} ${transcriptText}` : `${prev}; ${transcriptText}`
                  }
                  return transcriptText
                })
              }
            } else {
              console.log("Ignored non-English transcription:", message.data.utterance.language)
            }
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err)
        }
      })

      socket.addEventListener("error", (event) => {
        console.error("WebSocket error:", event)
        setError("Connection error with transcription service")
      })

      socket.addEventListener("close", (event) => {
        console.log("WebSocket connection closed:", event.code, event.reason)
        if (event.code !== 1000) {
          setError("Connection to transcription service was closed unexpectedly")
        }
      })
    } catch (err) {
      console.error("Error starting recording:", err)
      setError("Failed to start recording. Please try again.")
    }
  }

  // Stop recording audio
  const stopRecording = () => {
    try {
      // Stop MediaRecorder
      if (mediaRecorder) {
        mediaRecorder.stop()
      }

      // Send stop_recording message to WebSocket
      if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
        webSocketRef.current.send(
          JSON.stringify({
            type: "stop_recording",
          }),
        )
      }

      // Clean up audio processing
      if (processorNodeRef.current && audioContextRef.current) {
        processorNodeRef.current.disconnect()
        audioContextRef.current.close()
      }

      // Stop all audio tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      // Close WebSocket connection
      if (webSocketRef.current) {
        webSocketRef.current.close(1000)
        webSocketRef.current = null
      }

      setIsRecording(false)
    } catch (err) {
      console.error("Error stopping recording:", err)
      setError("Failed to stop recording properly")
      setIsRecording(false)
    }
  }

  // Convert Float32Array to Int16Array for PCM audio
  function convertFloat32ToInt16(buffer: Float32Array): ArrayBuffer {
    const l = buffer.length
    const buf = new Int16Array(l)

    for (let i = 0; i < l; i++) {
      // Convert float [-1, 1] to int16 [-32768, 32767]
      const s = Math.max(-1, Math.min(1, buffer[i]))
      buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    return buf.buffer
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording()
      }
    }
  }, [])

  // If patient not found, show error message
  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-teal-700 text-white p-6 shadow-md">
          <div className="container mx-auto text-center">
            <h1 className="text-3xl font-bold mb-1">Endo Clinic</h1>
            <p className="text-xl font-medium text-teal-100">Atallah Alruhaily - Consultant Endocrinologist</p>
          </div>
        </header>

        <main className="container mx-auto p-4">
          <div className="mb-4">
            <Link href="/">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft size={16} /> Back to Patient List
              </Button>
            </Link>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-bold text-red-600 mb-2">Patient Not Found</h2>
              <p className="mb-4">The patient with ID "{patientId}" could not be found.</p>
              <Link href="/">
                <Button>Return to Patient List</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Main UI for patient details
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-700 text-white p-6 shadow-md">
        <div className="container mx-auto text-center">
          <h1 className="text-3xl font-bold mb-1">Endo Clinic</h1>
          <p className="text-xl font-medium text-teal-100">Atallah Alruhaily - Consultant Endocrinologist</p>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="mb-4">
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft size={16} /> Back to Patient List
            </Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">{patient.name}</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-6">
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline" className="bg-blue-50">
                    ID: {patient.id}
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50">
                    Diagnosis: {patient.diagnosis}
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50">
                    Date: {new Date(patient.date).toLocaleDateString()}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Patient Information</h3>
                    <p className="text-gray-600 mb-1">Name: {patient.name}</p>
                    <p className="text-gray-600">ID: {patient.id}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Medical Information</h3>
                    <p className="text-gray-600 mb-1">Diagnosis: {patient.diagnosis}</p>
                    <p className="text-gray-600">Date: {new Date(patient.date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">Consultation Notes</h3>

                <div className="grid gap-4">
                  {error && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}
                  
                  {!permissionGranted && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                      <h4 className="font-medium mb-1">Microphone Permission Required</h4>
                      <p>To use audio recording features, please enable microphone access in your browser settings and reload the page.</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button
                      variant={isRecording ? "destructive" : "default"}
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center gap-2 ${!isRecording ? "bg-red-600 hover:bg-red-700" : ""}`}
                      disabled={!permissionGranted}
                    >
                      {isRecording ? (
                        <>
                          <X size={16} /> Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic size={16} /> Record Audio (English Only)
                        </>
                      )}
                    </Button>

                    {audioURL && <audio controls src={audioURL} className="ml-2" />}
                  </div>

                  {/* Live transcription area */}
                  {isRecording && liveTranscription && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                        Live Transcription (English):
                      </h4>
                      <p className="text-gray-700">{liveTranscription}</p>
                    </div>
                  )}

                  {/* Recorded text area */}
                  {recordedText && (
                    <div className="relative p-4 bg-gray-50 rounded-md border">
                      <div className="absolute top-2 right-2">
                        <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-8 w-8 p-0">
                          <Copy size={16} />
                          <span className="sr-only">Copy to clipboard</span>
                        </Button>
                      </div>
                      <h4 className="font-medium mb-2">Transcription:</h4>
                      <p className="text-gray-700 pr-8">{recordedText}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 