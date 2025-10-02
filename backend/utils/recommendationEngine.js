import sharp from "sharp"
import Product from "../models/Product.js"

// Extract dominant colors from image
async function extractColors(imagePath) {
  try {
    console.log("[v0] 🎨 Starting color extraction from image:", imagePath)

    // Resize image and get raw pixel data
    const { data, info } = await sharp(imagePath).resize(100, 100).raw().toBuffer({ resolveWithObject: true })
    console.log("[v0] 📊 Image processed - Size:", info.width, "x", info.height, "Channels:", info.channels)

    // Simple color extraction (you can enhance this with better algorithms)
    const colors = []
    const colorCounts = {}

    console.log("[v0] 🔍 Analyzing", data.length / 3, "pixels for color extraction...")

    // Sample pixels and count colors
    for (let i = 0; i < data.length; i += 12) {
      // Sample every 4th pixel
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Convert to hex
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`

      // Group similar colors
      const colorGroup = getColorGroup(r, g, b)
      colorCounts[colorGroup] = (colorCounts[colorGroup] || 0) + 1
    }

    console.log("[v0] 🎯 Raw color counts:", colorCounts)

    // Get top 3 dominant color groups
    const sortedColors = Object.entries(colorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([color]) => color)

    console.log("[v0] ✅ Top 3 dominant colors extracted:", sortedColors)
    return sortedColors
  } catch (error) {
    console.error("[v0] ❌ Color extraction error:", error)
    return ["neutral"] // Fallback
  }
}

// Group colors into categories
function getColorGroup(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min

  // Check for grayscale
  if (diff < 30) {
    if (max < 80) {
      console.log(`[v0] 🖤 RGB(${r},${g},${b}) -> black (max: ${max})`)
      return "black"
    }
    if (max > 200) {
      console.log(`[v0] ⚪ RGB(${r},${g},${b}) -> white (max: ${max})`)
      return "white"
    }
    console.log(`[v0] 🔘 RGB(${r},${g},${b}) -> gray (max: ${max})`)
    return "gray"
  }

  // Determine dominant color
  if (r > g && r > b) {
    const result = g > 100 ? "orange" : "red"
    console.log(`[v0] 🔴 RGB(${r},${g},${b}) -> ${result} (r dominant, g: ${g})`)
    return result
  } else if (g > r && g > b) {
    const result = b > 100 ? "teal" : "green"
    console.log(`[v0] 🟢 RGB(${r},${g},${b}) -> ${result} (g dominant, b: ${b})`)
    return result
  } else if (b > r && b > g) {
    const result = r > 100 ? "purple" : "blue"
    console.log(`[v0] 🔵 RGB(${r},${g},${b}) -> ${result} (b dominant, r: ${r})`)
    return result
  }

  console.log(`[v0] ⚫ RGB(${r},${g},${b}) -> neutral (fallback)`)
  return "neutral"
}

function convertBudgetRange(budgetRange) {
  const budgetMap = {
    low: 10000,
    medium: 50000,
    high: 100000,
  }

  // If it's already a number, return it
  if (!isNaN(Number(budgetRange))) {
    return Number(budgetRange)
  }

  // If it's a string range, convert it
  if (typeof budgetRange === "string" && budgetMap[budgetRange.toLowerCase()]) {
    return budgetMap[budgetRange.toLowerCase()]
  }

  return null
}

// Main recommendation engine
async function getRecommendations({
  colors = [],
  occasion = "daily",
  style = "modern",
  budget = 10000,
  category = null,
}) {
  try {
    console.log("[v0] 🚀 Starting recommendation engine with preferences:")
    console.log("[v0] 🎨 Colors:", colors)
    console.log("[v0] 🎭 Occasion:", occasion)
    console.log("[v0] ✨ Style:", style)
    console.log("[v0] 💰 Budget (raw):", budget, "Type:", typeof budget)
    console.log("[v0] 📂 Category:", category)

    const validBudget = convertBudgetRange(budget)
    console.log("[v0] 💰 Converted budget:", validBudget)

    let query = {
      inStock: true,
    }

    if (validBudget !== null && validBudget > 0) {
      query.price = { $lte: validBudget }
      console.log("[v0] 💰 Added price filter: ≤ ₹", validBudget)
    } else {
      console.log("[v0] 💰 No price filter applied (budget invalid or not provided)")
    }

    // Add style filter
    if (style) {
      query.style = style
      console.log("[v0] 🎯 Added style filter:", style)
    }

    // Add occasion filter
    if (occasion) {
      query.occasions = { $in: [occasion] }
      console.log("[v0] 🎭 Added occasion filter:", occasion)
    }

    // Add category filter
    if (category) {
      query.category = category
      console.log("[v0] 📂 Added category filter:", category)
    }

    // Color matching logic
    if (colors.length > 0) {
      const complementaryColors = getComplementaryColors(colors)
      console.log("[v0] 🌈 Complementary colors for", colors, ":", complementaryColors)

      // Find products with matching or complementary colors
      const colorQuery = {
        $or: [
          { colors: { $in: colors } }, // Direct color match
          { colors: { $in: complementaryColors } }, // Complementary colors
        ],
      }
      query = { ...query, ...colorQuery }
      console.log("[v0] 🎨 Added color matching query")
    }

    console.log("[v0] 🔍 Final MongoDB query:", JSON.stringify(query, null, 2))

    // Get products and populate designer info
    let products = await Product.find(query)
      .populate("designer", "name businessName location")
      .sort({ createdAt: -1 })
      .limit(20)

    console.log("[v0] 📦 Found", products.length, "products matching criteria")

    // If no products found, relax constraints
    if (products.length === 0) {
      console.log("[v0] ⚠️ No products found, relaxing color constraints...")
      delete query.colors
      products = await Product.find(query)
        .populate("designer", "name businessName location")
        .sort({ createdAt: -1 })
        .limit(10)
      console.log("[v0] 📦 Found", products.length, "products after relaxing constraints")
    }

    // Score and sort recommendations
    console.log("[v0] 🧮 Calculating recommendation scores...")
    const scoredProducts = products.map((product) => {
      const scoringBudget = validBudget || 50000 // Default budget for scoring if none provided
      const score = calculateRecommendationScore(product, { colors, occasion, style, budget: scoringBudget })
      console.log(`[v0] 📊 Product "${product.name}" scored: ${score.toFixed(2)}`)
      return {
        ...product.toObject(),
        score: score,
      }
    })

    // Sort by score and return top recommendations
    const finalRecommendations = scoredProducts.sort((a, b) => b.score - a.score).slice(0, 12)
    console.log("[v0] 🏆 Top recommendations (by score):")
    finalRecommendations.forEach((product, index) => {
      console.log(
        `[v0] ${index + 1}. "${product.name}" - Score: ${product.score.toFixed(2)} - Price: ₹${product.price}`,
      )
    })

    return finalRecommendations
  } catch (error) {
    console.error("[v0] ❌ Recommendation error:", error)
    return []
  }
}

// Calculate recommendation score
function calculateRecommendationScore(product, preferences) {
  let score = 0
  const breakdown = {}

  console.log(`[v0] 🧮 Scoring "${product.name}"...`)

  // Color matching score (40% weight)
  if (preferences.colors && preferences.colors.length > 0) {
    const directMatches = product.colors.filter((color) => preferences.colors.includes(color))
    const complementaryMatches = product.colors.filter((color) =>
      getComplementaryColors(preferences.colors).includes(color),
    )

    const totalMatches = [...new Set([...directMatches, ...complementaryMatches])].length
    const colorScore = (totalMatches / Math.max(preferences.colors.length, 1)) * 40

    breakdown.colorScore = colorScore
    score += colorScore

    console.log(`[v0]   🎨 Color Analysis:`)
    console.log(`[v0]     - Product colors: [${product.colors.join(", ")}]`)
    console.log(`[v0]     - Direct matches: [${directMatches.join(", ")}]`)
    console.log(`[v0]     - Complementary matches: [${complementaryMatches.join(", ")}]`)
    console.log(`[v0]     - Color score: ${colorScore.toFixed(2)}/40`)
  }

  // Style matching (25% weight)
  if (product.style === preferences.style) {
    breakdown.styleScore = 25
    score += 25
    console.log(`[v0]   ✨ Style match: ${product.style} = +25 points`)
  } else {
    breakdown.styleScore = 0
    console.log(`[v0]   ✨ Style mismatch: ${product.style} vs ${preferences.style} = +0 points`)
  }

  // Occasion matching (20% weight)
  if (product.occasions.includes(preferences.occasion)) {
    breakdown.occasionScore = 20
    score += 20
    console.log(`[v0]   🎭 Occasion match: ${preferences.occasion} in [${product.occasions.join(", ")}] = +20 points`)
  } else {
    breakdown.occasionScore = 0
    console.log(
      `[v0]   🎭 Occasion mismatch: ${preferences.occasion} not in [${product.occasions.join(", ")}] = +0 points`,
    )
  }

  // Price appropriateness (15% weight)
  const priceRatio = product.price / preferences.budget
  let priceScore = 0
  if (priceRatio <= 0.5) priceScore = 15
  else if (priceRatio <= 0.8) priceScore = 10
  else if (priceRatio <= 1.0) priceScore = 5

  breakdown.priceScore = priceScore
  score += priceScore
  console.log(
    `[v0]   💰 Price analysis: ₹${product.price}/₹${preferences.budget} (${(priceRatio * 100).toFixed(1)}%) = +${priceScore} points`,
  )

  console.log(`[v0]   🏆 Total score: ${score.toFixed(2)}/100`)
  return score
}

// Get complementary colors
function getComplementaryColors(colors) {
  const complementaryMap = {
    red: ["gold", "green", "white"],
    blue: ["silver", "white", "gold"],
    green: ["gold", "red", "white"],
    yellow: ["blue", "purple", "silver"],
    orange: ["blue", "teal", "gold"],
    purple: ["yellow", "gold", "silver"],
    pink: ["green", "gold", "silver"],
    black: ["gold", "silver", "white"],
    white: ["gold", "silver", "black"],
    gray: ["gold", "silver", "blue"],
    gold: ["red", "green", "blue"],
    silver: ["blue", "purple", "black"],
  }

  const complementary = []
  colors.forEach((color) => {
    if (complementaryMap[color]) {
      complementary.push(...complementaryMap[color])
    }
  })

  return [...new Set(complementary)] // Remove duplicates
}

export { extractColors, getRecommendations, calculateRecommendationScore, convertBudgetRange }
