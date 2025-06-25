import React, { useState, useRef, useCallback, useEffect } from "react";
import { transcribeAudio } from "./api/api";
import { exportToDocx } from "./utils/exportToDocx";

function App() {
  // State for recording and transcription
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [isContinuousMode, setIsContinuousMode] = useState(false);

  // Session management
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [caseSessions, setCaseSessions] = useState<
    {
      id: string;
      title: string;
      createdAt: string;
      lastUpdated: string;
      transcript: string;
      segments: Array<{ text: string; timestamp: string }>;
    }[]
  >([]);

  const [transcriptionHistory, setTranscriptionHistory] = useState<string[]>(
    []
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoTranscribeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved data from localStorage on component mount
  useEffect(() => {
    const savedTranscriptions = localStorage.getItem("transcriptionHistory");
    if (savedTranscriptions) {
      setTranscriptionHistory(JSON.parse(savedTranscriptions));
    }

    const savedCases = localStorage.getItem("caseSessions");
    if (savedCases) {
      setCaseSessions(JSON.parse(savedCases));
    }

    const lastActiveCaseId = localStorage.getItem("activeCaseId");
    if (lastActiveCaseId) {
      setActiveCaseId(lastActiveCaseId);

      // Load the active case transcript
      const cases = savedCases ? JSON.parse(savedCases) : [];
      const activeCase = cases.find((c: any) => c.id === lastActiveCaseId);
      if (activeCase) {
        setTranscript(activeCase.transcript);
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(
      "transcriptionHistory",
      JSON.stringify(transcriptionHistory)
    );
  }, [transcriptionHistory]);

  useEffect(() => {
    localStorage.setItem("caseSessions", JSON.stringify(caseSessions));
  }, [caseSessions]);

  useEffect(() => {
    if (activeCaseId) {
      localStorage.setItem("activeCaseId", activeCaseId);
    }
  }, [activeCaseId]);

  // Update active case transcript whenever transcript changes
  useEffect(() => {
    if (activeCaseId && transcript) {
      setCaseSessions((prev) =>
        prev.map((caseSession) => {
          if (caseSession.id === activeCaseId) {
            return {
              ...caseSession,
              transcript,
              lastUpdated: new Date().toISOString(),
            };
          }
          return caseSession;
        })
      );
    }
  }, [transcript, activeCaseId]);

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
      setSuccess(
        "Recording started - you can pause anytime and continue the same case"
      );
    } catch (err) {
      setError(
        "Error accessing microphone. Please ensure you have granted microphone permissions."
      );
      console.error("Error accessing microphone:", err);
    }
  }, []);
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

      const response = await transcribeAudio(formData);

      if (response.data?.transcription) {
        const newText = response.data.transcription;
        setTranscript((prev) => (prev ? `${prev}\n\n${newText}` : newText));
        setSuccess("Transcription added successfully!");

        // Optionally update segments
        if (activeCaseId) {
          setCaseSessions((prev) =>
            prev.map((caseSession) =>
              caseSession.id === activeCaseId
                ? {
                    ...caseSession,
                    segments: [
                      ...caseSession.segments,
                      {
                        text: newText,
                        timestamp: new Date().toLocaleTimeString(),
                      },
                    ],
                  }
                : caseSession
            )
          );
        }
      } else {
        throw new Error("No transcription received from server");
      }

      // Clear recorded chunks
      audioChunksRef.current = [];

      // Restart recording if in continuous mode
      if (isContinuousMode) {
        if (autoTranscribeTimeoutRef.current) {
          clearTimeout(autoTranscribeTimeoutRef.current);
        }
        autoTranscribeTimeoutRef.current = setTimeout(() => {
          startRecording();
        }, 1000);
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      if (err.response) {
        setError(
          `Server error: ${err.response.data.error || err.response.statusText}`
        );
      } else if (err.request) {
        setError("No response from server. Is the backend running?");
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [isContinuousMode, activeCaseId, startRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        handleTranscribe();
      };

      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());

      setIsRecording(false);
    }
  }, [isRecording, handleTranscribe]);
  const handleExport = useCallback(() => {
    try {
      exportToDocx(transcript);
      setSuccess("Document exported successfully!");
    } catch (err) {
      setError("Error exporting document. Please try again.");
      console.error("Error exporting:", err);
    }
  }, [transcript]);

  const handleClear = useCallback(() => {
    setTranscript("");
    setError(null);
    setSuccess(null);
  }, []);

  // Cleanup function for continuous mode
  useEffect(() => {
    return () => {
      if (autoTranscribeTimeoutRef.current) {
        clearTimeout(autoTranscribeTimeoutRef.current);
      }
    };
  }, []);

  // Create a new case session
  const createNewCase = useCallback(() => {
    const newCaseId = `case-${Date.now()}`;
    const newCase = {
      id: newCaseId,
      title: `Case ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      transcript: "",
      segments: [],
    };

    setCaseSessions((prev) => [...prev, newCase]);
    setActiveCaseId(newCaseId);
    setTranscript("");
    setSuccess(`New case created: ${newCase.title}`);
  }, []);

  // Load an existing case
  const loadCase = useCallback(
    (caseId: string) => {
      const caseToLoad = caseSessions.find((c) => c.id === caseId);
      if (caseToLoad) {
        setActiveCaseId(caseId);
        setTranscript(caseToLoad.transcript);
        setSuccess(`Loaded case: ${caseToLoad.title}`);
      }
    },
    [caseSessions]
  );

  // Rename the current case
  const renameCurrentCase = useCallback(
    (newTitle: string) => {
      if (activeCaseId) {
        setCaseSessions((prev) =>
          prev.map((caseSession) => {
            if (caseSession.id === activeCaseId) {
              return {
                ...caseSession,
                title: newTitle,
                lastUpdated: new Date().toISOString(),
              };
            }
            return caseSession;
          })
        );
        setSuccess(`Case renamed to: ${newTitle}`);
      }
    },
    [activeCaseId]
  );

  // Get the active case
  const activeCase = activeCaseId
    ? caseSessions.find((c) => c.id === activeCaseId)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <header className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white py-3 px-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-medium tracking-wide">
          Case Register Agent
        </h1>
        {activeCase && (
          <div className="text-sm font-medium">
            Current Case: {activeCase.title}
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4 max-w-6xl mx-auto w-full items-stretch">
        {/* Left Side - Voice Controls & Case Management */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          {/* Case Management */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Case Management
            </h3>

            <div className="flex gap-2 mb-3">
              <button
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm flex-1"
                onClick={createNewCase}
              >
                New Case
              </button>

              {activeCase && (
                <button
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 transition-colors shadow-sm flex-1"
                  onClick={() => {
                    const newTitle = prompt(
                      "Enter new case title:",
                      activeCase.title
                    );
                    if (newTitle) renameCurrentCase(newTitle);
                  }}
                >
                  Rename
                </button>
              )}
            </div>

            {caseSessions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-1">
                  Your Cases:
                </h4>
                <div className="max-h-[150px] overflow-y-auto border border-gray-100 rounded-md bg-gray-50">
                  <ul className="divide-y divide-gray-100">
                    {caseSessions.map((caseSession) => (
                      <li
                        key={caseSession.id}
                        className={`p-2 text-xs hover:bg-gray-100 cursor-pointer ${
                          caseSession.id === activeCaseId
                            ? "bg-blue-50 font-medium"
                            : ""
                        }`}
                        onClick={() => loadCase(caseSession.id)}
                      >
                        <div className="flex justify-between items-center">
                          <span>{caseSession.title}</span>
                          <span className="text-gray-400 text-[10px]">
                            {new Date(
                              caseSession.lastUpdated
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Voice Controls */}
          <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col items-center justify-start gap-4 transition-all duration-200">
            <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center mb-2 shadow-inner">
              <button
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isRecording
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                <span className="text-sm font-medium">
                  {isRecording ? "Pause" : "Record"}
                </span>
              </button>
            </div>

            <div className="flex gap-2 w-full justify-center">
              {/* <button
                className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700 transition-colors shadow-sm"
                onClick={handleTranscribe}
                disabled={
                  loading || isRecording || audioChunksRef.current.length === 0
                }
              >
                {loading ? "Processing..." : "Transcribe"}
              </button> */}

              <button
                className="px-4 py-2 rounded-md text-sm font-medium bg-gray-600 text-white disabled:opacity-50 hover:bg-gray-700 transition-colors shadow-sm"
                onClick={handleClear}
                disabled={!transcript}
              >
                Clear
              </button>
            </div>

            {/* Status Messages */}
            {loading && (
              <div className="text-blue-600 animate-pulse text-center text-sm">
                Processing speech...
              </div>
            )}
            {error && (
              <div className="text-red-600 bg-red-50 p-2 rounded-md w-full text-center text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="text-green-600 bg-green-50 p-2 rounded-md w-full text-center text-sm">
                {success}
              </div>
            )}
          </div>

          {/* Transcription History */}
          {activeCase && activeCase.segments.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4 w-full">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Case Segments
              </h3>
              <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded-md bg-gray-50">
                <ul className="divide-y divide-gray-100">
                  {activeCase.segments.map((segment, index) => (
                    <li
                      key={index}
                      className="p-2 text-xs hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        // Scroll to this segment in the transcript
                        const segmentText = segment.text;
                        const textArea = document.querySelector("textarea");
                        if (textArea) {
                          const position = transcript.indexOf(segmentText);
                          if (position !== -1) {
                            textArea.focus();
                            textArea.setSelectionRange(
                              position,
                              position + segmentText.length
                            );
                          }
                        }
                      }}
                    >
                      <span className="font-medium block">
                        {segment.timestamp}
                      </span>
                      <span className="text-gray-600 block truncate">
                        {segment.text.substring(0, 50)}...
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Text Editor */}
        <div className="w-full lg:w-2/3 bg-white rounded-lg shadow-sm p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-800">
              {activeCase ? `Editing: ${activeCase.title}` : "Document Editor"}
            </h2>
            <button
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-green-600 text-white disabled:opacity-50 hover:bg-green-700 transition-colors shadow-sm"
              onClick={handleExport}
              disabled={!transcript}
            >
              Export DOCX
            </button>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              activeCase
                ? "Start recording or type to add to this case..."
                : "Create or select a case to begin..."
            }
            className="w-full flex-1 min-h-[400px] p-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none text-sm"
          />

          <div className="text-xs text-gray-500">
            {activeCase
              ? "This case will automatically save as you record or edit. You can pause and resume recording anytime."
              : "Create a new case or select an existing one to begin recording."}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
