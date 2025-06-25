import { useState, useRef, useCallback } from "react";
import axios from "axios";
import { exportToDocx } from "../utils/exportToDocx";

const VoiceInputPage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("Recording stopped. Transcribing...");
        handleTranscribe();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setError(null);
    } catch (err) {
      setError("Microphone access error. Please check permissions.");
      console.error("Microphone error:", err);
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
      setIsPaused(true);
    }
  }, [isRecording]);

  const handleTranscribe = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      setError("No audio recorded.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const response = await axios.post(
        "http://localhost:3001/api/transcribe",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 30000,
        }
      );

      if (response.data.transcription) {
        setTranscript((prev) =>
          prev
            ? `${prev}\n${response.data.transcription}`
            : response.data.transcription
        );
        setSuccess("Transcription completed successfully!");
      } else {
        throw new Error("No transcription received.");
      }

      audioChunksRef.current = [];
    } catch (err: any) {
      console.error("Transcription error:", err);
      if (err.response) {
        setError(err.response.data.error || "Transcription failed.");
      } else {
        setError("Transcription failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExport = useCallback(() => {
    try {
      exportToDocx(transcript);
      setSuccess("Document exported successfully!");
    } catch (err) {
      setError("Failed to export document.");
      console.error("Export error:", err);
    }
  }, [transcript]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 items-center p-4">
      <h2 className="text-2xl font-bold mb-2">Voice Input</h2>

      <div className="flex gap-4">
        {!isRecording && !isPaused ? (
          <button
            className="px-6 py-3 rounded-lg text-lg font-semibold bg-blue-700 text-white hover:opacity-90"
            onClick={startRecording}
          >
            Start Recording
          </button>
        ) : isRecording ? (
          <button
            className="px-6 py-3 rounded-lg text-lg font-semibold bg-yellow-600 text-white hover:opacity-90"
            onClick={pauseRecording}
          >
            Pause & Transcribe
          </button>
        ) : (
          <button
            className="px-6 py-3 rounded-lg text-lg font-semibold bg-green-700 text-white hover:opacity-90"
            onClick={startRecording}
          >
            Resume Recording
          </button>
        )}
      </div>

      {/* Status Messages */}
      {loading && <div className="text-blue-700">Transcribing...</div>}
      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>
      )}
      {success && (
        <div className="text-green-600 bg-green-50 p-3 rounded">{success}</div>
      )}

      {/* Transcript Box */}
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Transcribed Telugu text will appear here..."
        className="w-full min-h-[200px] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <button
        className="px-6 py-3 rounded-lg text-lg font-semibold bg-purple-700 text-white disabled:opacity-50 hover:opacity-90"
        onClick={handleExport}
        disabled={!transcript}
      >
        Export as .docx
      </button>
    </div>
  );
};

export default VoiceInputPage;
