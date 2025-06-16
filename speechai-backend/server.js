const express = require("express");
const cors = require("cors");
const multer = require("multer");
const speech = require("@google-cloud/speech");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Initialize Speech-to-Text client
const client = new speech.SpeechClient({
  keyFilename: "./google-credentials.json",
});

// Transcribe endpoint
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No audio file provided" });
    }

    console.log("Processing file:", req.file.originalname);
    const audioBytes = fs.readFileSync(req.file.path).toString("base64");

    const request = {
      audio: {
        content: audioBytes,
      },
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 16000,
        languageCode: "te-IN", // Telugu language code
        enableAutomaticPunctuation: true,
        model: "default",
        useEnhanced: true,
      },
    };

    console.log("Sending request to Google Speech-to-Text API");
    const [response] = await client.recognize(request);

    if (!response.results || response.results.length === 0) {
      console.error("No transcription results");
      return res.status(400).json({ error: "Could not transcribe audio" });
    }

    const transcription = response.results
      .map((result) => result.alternatives[0].transcript)
      .join("\n");

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    console.log("Transcription completed successfully");

    res.json({ transcription });
  } catch (error) {
    console.error("Error processing request:", error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Send appropriate error message
    if (error.code === "LIMIT_FILE_SIZE") {
      res
        .status(400)
        .json({ error: "File size too large. Maximum size is 10MB" });
    } else if (error.message === "Only audio files are allowed") {
      res.status(400).json({ error: "Only audio files are allowed" });
    } else if (
      error.code === "ENOENT" &&
      error.path &&
      error.path.includes("google-credentials.json")
    ) {
      res.status(500).json({
        error:
          "Google Cloud credentials not found. Please check your configuration.",
      });
    } else {
      res
        .status(500)
        .json({ error: "Error processing audio file: " + error.message });
    }
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
});
