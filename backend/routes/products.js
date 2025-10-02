import express from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import { v4 as uuidv4 } from "uuid"
import { fileURLToPath } from "url"
import Product from "../models/Product.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/product-images"
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `product-${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`
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

// Get all products with filtering
router.get("/", async (req, res) => {
  try {
    const { category, style, minPrice, maxPrice, occasion, designer, search, page = 1, limit = 20 } = req.query

    // Build filter object
    const filter = { inStock: true }

    if (category) filter.category = category
    if (style) filter.style = style
    if (occasion) filter.occasions = { $in: [occasion] }
    if (designer) filter.designer = designer

    if (minPrice || maxPrice) {
      filter.price = {}
      if (minPrice) filter.price.$gte = Number.parseInt(minPrice)
      if (maxPrice) filter.price.$lte = Number.parseInt(maxPrice)
    }

    // Text search
    if (search) {
      filter.$text = { $search: search }
    }

    const products = await Product.find(filter)
      .populate("designer", "name businessName location")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Product.countDocuments(filter)

    res.json({
      products,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products", error: error.message })
  }
})

// Get single product
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "designer",
      "name businessName description location contact",
    )

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    res.json(product)
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch product", error: error.message })
  }
})

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, category, subcategory, materials, occasions, style, colors } = req.body

    console.log("[v0] 📝 Product form data received:", {
      name,
      description,
      price,
      category,
      subcategory,
      materials,
      occasions,
      style,
      colors,
    })

    let imageUrl = "/placeholder.svg?height=200&width=200"
    if (req.file) {
      imageUrl = `/uploads/product-images/${req.file.filename}`
      console.log("[v0] 📸 Product image uploaded:", imageUrl)
    }

    const validOccasions = ["daily", "office", "party", "wedding", "festival"]
    let processedOccasions = ["daily"] // default

    if (occasions) {
      const occasionList = Array.isArray(occasions)
        ? occasions
        : occasions.split(",").map((o) => o.trim().toLowerCase())
      processedOccasions = occasionList
        .map((occasion) => {
          // Map frontend values to backend enum values
          switch (occasion) {
            case "casual":
              return "daily"
            case "formal":
              return "office"
            case "party":
              return "party"
            case "wedding":
              return "wedding"
            case "festival":
              return "festival"
            default:
              return "daily"
          }
        })
        .filter((o) => validOccasions.includes(o))

      if (processedOccasions.length === 0) {
        processedOccasions = ["daily"]
      }
    }

    const validStyles = ["traditional", "modern", "fusion", "minimalist"]
    let processedStyle = "traditional" // default

    if (style) {
      const styleValue = style.toLowerCase()
      switch (styleValue) {
        case "vintage":
          processedStyle = "traditional"
        case "traditional":
          processedStyle = "traditional"
        case "modern":
          processedStyle = "modern"
        case "fusion":
          processedStyle = "fusion"
        case "minimalist":
          processedStyle = "minimalist"
        default:
          processedStyle = "traditional"
      }
    }

    const validMaterials = [
      "gold",
      "silver",
      "platinum",
      "diamond",
      "pearl",
      "gemstone",
      "artificial",
      "kundan",
      "meenakari",
      "polki",
      "jadau",
      "brass",
      "copper",
      "ruby",
      "emerald",
      "sapphire",
    ]
    let processedMaterials = ["gold"] // default

    if (materials) {
      const materialList = Array.isArray(materials)
        ? materials
        : materials.split(",").map((m) => m.trim().toLowerCase())
      processedMaterials = materialList.filter((m) => validMaterials.includes(m))

      if (processedMaterials.length === 0) {
        processedMaterials = ["gold"]
      }
    }

    console.log("[v0] 🔄 Processed data:", {
      occasions: processedOccasions,
      style: processedStyle,
      materials: processedMaterials,
      subcategory,
    })

    const product = new Product({
      name,
      description,
      price: Number(price),
      category,
      subcategory, // Added subcategory field
      materials: processedMaterials,
      occasions: processedOccasions,
      colors: colors ? (Array.isArray(colors) ? colors : colors.split(",").map((c) => c.trim())) : ["gold"],
      style: processedStyle,
      imageUrl,
      designer: req.user.id, // Assuming the logged-in user is the designer
      inStock: true,
    })

    await product.save()
    console.log("[v0] ✅ Product created successfully:", product.name)
    res.status(201).json({ message: "Product created successfully", product })
  } catch (error) {
    console.error("[v0] ❌ Product creation error:", error)
    res.status(500).json({ message: "Failed to create product", error: error.message })
  }
})

router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, category, subcategory, materials, occasions, style, colors } = req.body

    const updateData = {
      name,
      description,
      price: Number(price),
      category,
      subcategory, // Added subcategory field
      materials: materials
        ? Array.isArray(materials)
          ? materials
          : materials.split(",").map((m) => m.trim())
        : undefined,
      occasions: occasions
        ? Array.isArray(occasions)
          ? occasions
          : occasions.split(",").map((o) => o.trim())
        : undefined,
      colors: colors ? (Array.isArray(colors) ? colors : colors.split(",").map((c) => c.trim())) : undefined,
      style,
    }

    if (req.file) {
      updateData.imageUrl = `/uploads/product-images/${req.file.filename}`
      console.log("[v0] 📸 Product image updated:", updateData.imageUrl)
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    res.json({ message: "Product updated successfully", product })
  } catch (error) {
    res.status(500).json({ message: "Failed to update product", error: error.message })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    res.json({ message: "Product deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product", error: error.message })
  }
})

export default router
