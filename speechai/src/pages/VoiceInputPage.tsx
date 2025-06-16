import React, { useState, useRef, useCallback } from "react";
import axios from "axios";
import { exportToDocx } from "../utils/exportToDocx";

const VoiceInputPage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
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

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError(
        "Error accessing microphone. Please ensure you have granted microphone permissions."
      );
      console.error("Error accessing microphone:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleTranscribe = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      setError("No audio recorded. Please record some audio first.");
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
      formData.append("audio", audioBlob, "recording.webm");

      console.log("Sending audio to backend...");
      const response = await axios.post(
        "http://localhost:3001/api/transcribe",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 30000, // 30 second timeout
        }
      );

      if (response.data.transcription) {
        setTranscript(response.data.transcription);
        setSuccess("Transcription completed successfully!");
      } else {
        throw new Error("No transcription received from server");
      }

      audioChunksRef.current = [];
    } catch (err: any) {
      console.error("Error transcribing:", err);
      if (err.response) {
        setError(
          `Error: ${err.response.data.error || "Failed to transcribe audio"}`
        );
      } else if (err.request) {
        setError(
          "No response from server. Please check if the backend is running."
        );
      } else {
        setError("Error transcribing audio. Please try again.");
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
      setError("Error exporting document. Please try again.");
      console.error("Error exporting:", err);
    }
  }, [transcript]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 items-center p-4">
      <h2 className="text-2xl font-bold mb-2">Voice Input</h2>
      <div className="flex gap-4">
        <button
          className={`px-6 py-3 rounded-lg text-lg font-semibold ${
            isRecording ? "bg-red-600 text-white" : "bg-blue-700 text-white"
          } transition hover:opacity-90`}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? "Stop Recording" : "Record"}
        </button>
        <button
          className="px-6 py-3 rounded-lg text-lg font-semibold bg-green-700 text-white disabled:opacity-50 hover:opacity-90"
          onClick={handleTranscribe}
          disabled={
            loading || isRecording || audioChunksRef.current.length === 0
          }
        >
          {loading ? "Transcribing..." : "Transcribe"}
        </button>
      </div>

      {/* Status Messages */}
      {loading && <div className="text-blue-700">Transcribing...</div>}
      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>
      )}
      {success && (
        <div className="text-green-600 bg-green-50 p-3 rounded">{success}</div>
      )}

      {/* Text Editor */}
      <div className="w-full">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcribed Telugu text will appear here..."
          className="w-full min-h-[200px] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

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
