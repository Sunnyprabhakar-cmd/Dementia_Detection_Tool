import express from "express";
import cors from "cors";
import "dotenv/config";

import authRoutes from "./routes/authRoutes.js";
import screeningRoutes from "./routes/screeningRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import mlRoutes from "./routes/mlRoutes.js";
import audioRoutes from "./routes/audioRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";

const PORT = Number(process.env.PORT) || 3001;
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(cors());

app.get("/", (req, res) => {
  res.json({
    message: "MindScan AI server is running",
    status: "healthy"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/screening", screeningRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/audio", audioRoutes);
app.use("/api/results", resultRoutes);

app.listen(PORT, () => {
  console.log(`MindScan AI server is running on port ${PORT}`);
});