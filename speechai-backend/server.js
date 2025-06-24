const express = require("express");
const cors = require("cors");
const multer = require("multer");
const speech = require("@google-cloud/speech");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const port = process.env.PORT || 3001;

// Configure CORS
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // Vite's default ports
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

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

// Helper function to clean up files
const cleanupFiles = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Error cleaning up file:", error);
  }
};

// Transcribe endpoint
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  console.log("Received transcribe request:", {
    file: req.file,
    body: req.body
  });

  try {
    let inputPath = null;
    let outputPath = null;

    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({
        success: false,
        message: "No audio file provided",
        error: "No audio file uploaded"
      });
    }

    console.log("Processing file:", req.file.originalname);
    inputPath = req.file.path;
    outputPath = inputPath.replace(path.extname(inputPath), "_converted.wav");

    // Convert to 16-bit LINEAR16 WAV
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioChannels(1)
        .audioFrequency(16000)
        .audioCodec("pcm_s16le")
        .on("end", () => {
          console.log("Conversion completed:", outputPath);
          resolve();
        })
        .on("error", (err) => {
          console.error("Error converting audio:", err);
          reject(err);
        })
        .save(outputPath);
    });

    // Read converted audio file
    const audioBytes = fs.readFileSync(outputPath).toString("base64");

    const request = {
      audio: {
        content: audioBytes,
      },
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 16000,
        languageCode: "te-IN",
        enableAutomaticPunctuation: true,
        model: "default",
        useEnhanced: true,
      },
    };

    console.log("Sending request to Google Speech-to-Text API");
    const [response] = await client.recognize(request);

    if (!response.results || response.results.length === 0) {
      console.error("No transcription results");
      return res.status(400).json({
        success: false,
        message: "Could not transcribe audio",
        error: "No transcription results"
      });
    }

    const transcription = response.results
      .map((result) => result.alternatives[0].transcript)
      .join("\n");

    console.log("Transcription completed successfully");
    res.json({
      success: true,
      message: "Transcription completed successfully",
      transcription: transcription
    });
  } catch (error) {
    console.error("Error processing audio:", error);
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 10MB",
        error: error.message
      });
    } else if (error.message === "Only audio files are allowed") {
      res.status(400).json({
        success: false,
        message: "Only audio files are allowed",
        error: error.message
      });
    } else if (
      error.code === "ENOENT" &&
      error.path &&
      error.path.includes("google-credentials.json")
    ) {
      res.status(500).json({
        success: false,
        message: "Google Cloud credentials not found. Please check your configuration.",
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Error processing audio file",
        error: error.message || "Unknown error"
      });
    }
  } finally {
    // Clean up files
    cleanupFiles(inputPath);
    cleanupFiles(outputPath);
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message || "Unknown error"
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
});
