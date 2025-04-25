"use client"

import { useState, useEffect, useRef } from "react"
import { Mic, Copy, X, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { patients } from "@/lib/data"
import { initializeGladiaSession, isGladiaTranscriptMessage } from "@/lib/gladia-api"

export default function PatientDetails({ params }: { params: { id: string } }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedText, setRecordedText] = useState("")
  const [liveTranscription, setLiveTranscription] = useState("")
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioURL, setAudioURL] = useState("")
  const [error, setError] = useState<string | null>(null)

  const webSocketRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Find the patient by ID
  const patient = patients.find((p) => p.id === params.id)

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
          setError("Failed to access microphone. Please check your permissions.")
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
              <p className="mb-4">The patient with ID "{params.id}" could not be found.</p>
              <Link href="/">
                <Button>Return to Patient List</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

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
          <CardHeader className="pb-2 border-b">
            <CardTitle className="flex items-center gap-2">
              Patient File: {patient.name}
              <Badge className="ml-2">{patient.id}</Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid gap-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Patient Information</h3>
                  <div className="grid gap-2">
                    <p>
                      <span className="text-gray-500 font-medium">Name:</span> {patient.name}
                    </p>
                    <p>
                      <span className="text-gray-500 font-medium">ID:</span> {patient.id}
                    </p>
                    <p>
                      <span className="text-gray-500 font-medium">Diagnosis:</span> {patient.diagnosis}
                    </p>
                    <p>
                      <span className="text-gray-500 font-medium">Date:</span>{" "}
                      {new Date(patient.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3">Medical History</h3>
                  <p className="text-gray-600">
                    Patient has a history of endocrine disorders with initial diagnosis in 2022. Regular follow-ups have
                    been maintained with good medication adherence. Last visit was on{" "}
                    {new Date(new Date(patient.date).getTime() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}.
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">Consultation Notes</h3>

                <div className="grid gap-4">
                  {error && <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700">{error}</div>}

                  <div className="flex items-center gap-3">
                    <Button
                      variant={isRecording ? "destructive" : "default"}
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center gap-2 ${!isRecording ? "bg-red-600 hover:bg-red-700" : ""}`}
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
