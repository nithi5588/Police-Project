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
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No audio file provided" });
    }

    console.log("Processing file:", req.file.originalname);

    // Prepare paths
    const inputPath = req.file.path;
    const outputPath = inputPath.replace(
      path.extname(inputPath),
      "_converted.wav"
    );

    // Convert to 16-bit LINEAR16 WAV
    ffmpeg(inputPath)
      .audioChannels(1) // mono channel
      .audioFrequency(16000) // 16kHz sample rate
      .audioCodec("pcm_s16le") // 16-bit linear PCM
      .on("end", async () => {
        console.log("Conversion completed:", outputPath);

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
          return res.status(400).json({ error: "Could not transcribe audio" });
        }

        const transcription = response.results
          .map((result) => result.alternatives[0].transcript)
          .join("\n");

        // Clean up files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        console.log("Transcription completed successfully");

        res.json({ transcription });
      })
      .on("error", (err) => {
        console.error("Error converting audio:", err);
        fs.unlinkSync(inputPath);
        res
          .status(500)
          .json({ error: "Failed to convert audio: " + err.message });
      })
      .save(outputPath);
  } catch (error) {
    console.error("Error processing request:", error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

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
