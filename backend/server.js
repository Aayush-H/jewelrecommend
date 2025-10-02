import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

// Import routes
import authRoutes from "./routes/auth.js"
import userRoutes from "./routes/users.js"
import productRoutes from "./routes/products.js"
import recommendationRoutes from "./routes/recommendations.js"
import designerRoutes from "./routes/designers.js"

dotenv.config()

const app = express()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jewelry-recommendation")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err))

// API Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/products", productRoutes)
app.use("/api/recommendations", recommendationRoutes)
app.use("/api/designers", designerRoutes)

// The old code was serving dashboard.html, login.html, register.html
// Now the Next.js app (running on port 3000) handles all UI

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Jewelry Recommendation API is running",
    timestamp: new Date().toISOString(),
  })
})

// 404 handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({
    message: "API endpoint not found",
    path: req.path,
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err)
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📡 API available at http://localhost:${PORT}/api`)
  console.log(`🖼️  Uploads served at http://localhost:${PORT}/uploads`)
  console.log(`🎨 Frontend should run on http://localhost:3000`)
})
