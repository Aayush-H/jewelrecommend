"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Gem, Upload, Sparkles, LogOut, Heart, Star, ShoppingBag, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { recommendationsAPI } from "@/lib/api"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface JewelryItem {
  _id: string
  name: string
  price: number
  category: string
  subcategory: string
  images: Array<{ filename: string; url: string }>
  description: string
  materials: string[]
  colors: string[]
  style: string
  occasions: string[]
  designer: {
    _id: string
    name: string
    businessName: string
    location: { city: string; state: string }
  }
  score?: number
}

export default function RecommendationsPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [occasion, setOccasion] = useState("")
  const [style, setStyle] = useState("")
  const [budget, setBudget] = useState("")
  const [recommendations, setRecommendations] = useState<JewelryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedImage(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0])
    }
  }

  const handleGetRecommendations = async () => {
    setIsLoading(true)
    setError(null)

    try {
      let response

      if (selectedImage) {
        // Analyze image and get recommendations
        const formData = new FormData()
        formData.append("image", selectedImage)
        if (occasion) formData.append("occasion", occasion)
        if (style) formData.append("style", style)
        if (budget) formData.append("budget", budget)

        response = await recommendationsAPI.analyzeImage(formData)
        setRecommendations(response.recommendations)
      } else {
        // Get recommendations based on preferences only
        response = await recommendationsAPI.getSuggestions({
          occasion: occasion || "daily",
          style: style || "modern",
          budget: budget || "medium",
        })
        setRecommendations(response.recommendations)
      }
    } catch (error) {
      console.error("[v0] Recommendation error:", error)
      setError(error instanceof Error ? error.message : "Failed to get recommendations. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-slide-up">
          <div className="flex items-center gap-3">
            <Gem className="h-8 w-8 text-primary animate-float" />
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">Welcome, {user?.name}</h1>
              <p className="text-muted-foreground">Find your perfect jewelry match</p>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="flex items-center gap-2 rounded-xl hover-lift bg-transparent"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Upload and Preferences Section */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Image Upload */}
          <Card className="glass-card animate-slide-in-left hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Upload className="h-5 w-5" />
                Upload Your Style
              </CardTitle>
              <CardDescription>
                Upload an image of jewelry you like or your outfit for personalized recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                  dragActive
                    ? "border-primary bg-primary/5 scale-105"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {selectedImage ? (
                  <div className="space-y-4 animate-scale-in">
                    <div className="w-32 h-32 mx-auto bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      <img
                        src={URL.createObjectURL(selectedImage) || "/placeholder.svg"}
                        alt="Selected"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedImage.name}</p>
                    <Button
                      onClick={() => setSelectedImage(null)}
                      variant="outline"
                      size="sm"
                      className="rounded-lg hover-scale"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground animate-float" />
                    <div>
                      <p className="text-lg font-medium">Drop your image here</p>
                      <p className="text-sm text-muted-foreground">or click to browse</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      onClick={() => document.getElementById("file-upload")?.click()}
                      variant="outline"
                      className="rounded-lg hover-scale"
                    >
                      Choose File
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="glass-card animate-slide-in-right hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Sparkles className="h-5 w-5" />
                Your Preferences
              </CardTitle>
              <CardDescription>Tell us about the occasion and your style preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="occasion">Occasion</Label>
                <Select value={occasion} onValueChange={setOccasion}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select occasion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily Wear</SelectItem>
                    <SelectItem value="office">Office</SelectItem>
                    <SelectItem value="party">Party</SelectItem>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="festival">Festival</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="style">Style Preference</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="traditional">Traditional</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="fusion">Fusion</SelectItem>
                    <SelectItem value="minimalist">Minimalist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Budget Range</Label>
                <Select value={budget} onValueChange={setBudget}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select budget" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Under ₹10,000</SelectItem>
                    <SelectItem value="medium">₹10,000 - ₹50,000</SelectItem>
                    <SelectItem value="high">Above ₹50,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGetRecommendations}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-semibold rounded-xl hover-glow btn-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Finding matches...
                  </div>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Get Recommendations
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-serif font-bold text-foreground animate-slide-up gradient-text">
              Perfect Matches for You
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendations.map((item, index) => (
                <Card
                  key={item._id}
                  className={`glass-card hover:shadow-xl transition-all duration-500 animate-slide-up-delay-${index + 1} group cursor-pointer hover-lift`}
                >
                  <CardHeader className="p-0">
                    <div className="relative overflow-hidden rounded-t-xl">
                      <img
                        src={
                          item.images && item.images.length > 0
                            ? `http://localhost:5000${item.images[0].url}`
                            : "/placeholder.svg?height=256&width=256"
                        }
                        alt={item.name}
                        className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-4 right-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-full w-10 h-10 p-0 bg-white/90 hover:bg-white hover-scale"
                        >
                          <Heart className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="absolute bottom-4 left-4">
                        <Badge className="bg-black/70 text-white animate-fade-in capitalize">{item.category}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="font-serif font-semibold text-lg leading-tight">{item.name}</h3>
                        {item.score && (
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{(item.score / 20).toFixed(1)}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>

                      <div className="flex flex-wrap gap-1">
                        {item.materials.slice(0, 3).map((material) => (
                          <Badge key={material} variant="outline" className="text-xs capitalize">
                            {material}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-2xl font-bold text-primary">₹{item.price.toLocaleString()}</span>
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg hover-scale"
                        >
                          <ShoppingBag className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>

                      {item.designer && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          <p>
                            By <span className="font-medium">{item.designer.businessName}</span>
                          </p>
                          {item.designer.location && (
                            <p>
                              {item.designer.location.city}, {item.designer.location.state}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
