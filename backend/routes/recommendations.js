import express from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import { v4 as uuidv4 } from "uuid"
import { fileURLToPath } from "url"
import User from "../models/User.js"
import { extractColors, getRecommendations, convertBudgetRange } from "../utils/recommendationEngine.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/user-images"
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"))
    }
  },
})

// Upload image and get recommendations
router.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" })
    }

    const { occasion = "daily", style = "modern", budget = "medium" } = req.body

    console.log("[v0] 📝 Received recommendation request:")
    console.log("[v0] 🎭 Occasion:", occasion)
    console.log("[v0] ✨ Style:", style)
    console.log("[v0] 💰 Budget (raw):", budget)

    // Process image and extract colors
    const imagePath = req.file.path
    const dominantColors = await extractColors(imagePath)

    const numericBudget = convertBudgetRange(budget)
    console.log("[v0] 💰 Converted budget:", numericBudget)

    // Get recommendations based on colors and preferences
    const recommendations = await getRecommendations({
      colors: dominantColors,
      occasion,
      style,
      budget: numericBudget,
    })

    // If user is logged in, save to their profile
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, {
        $push: {
          uploadedImages: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            dominantColors,
            recommendations: recommendations.map((r) => r._id),
          },
        },
      })
    }

    res.json({
      message: "Image analyzed successfully",
      analysis: {
        dominantColors,
        imageUrl: `/uploads/user-images/${req.file.filename}`,
      },
      recommendations,
      preferences: { occasion, style, budget },
    })
  } catch (error) {
    console.error("Analysis error:", error)
    res.status(500).json({ message: "Analysis failed", error: error.message })
  }
})

// Get recommendations without image (based on preferences only)
router.post("/suggest", async (req, res) => {
  try {
    const { occasion, style, budget, category } = req.body

    const numericBudget = convertBudgetRange(budget)

    const recommendations = await getRecommendations({
      occasion,
      style,
      budget: numericBudget,
      category,
    })

    res.json({
      message: "Recommendations generated",
      recommendations,
      preferences: { occasion, style, budget: numericBudget, category },
    })
  } catch (error) {
    res.status(500).json({ message: "Failed to get recommendations", error: error.message })
  }
})

export default router
