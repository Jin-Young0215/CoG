"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Upload, X } from 'lucide-react'
import NextImage from "next/image"

interface PhotoUploadProps {
  animalType: "dog" | "cat"
  onBack: () => void
  onPhotoUploaded: (imageUrl: string, details: AnimalDetails) => void
}

interface AnimalDetails {
  breed: string
  gender: "male" | "female" | ""
  age: string
  name: string
  characteristics: string
  lostLocation: string
  lostDate: string
  ownerPhone: string
  reward: string
  photo: string
  neutered: "yes" | "no"
}

export function PhotoUpload({ animalType, onBack, onPhotoUploaded }: PhotoUploadProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [details, setDetails] = useState<AnimalDetails>({
    breed: "",
    gender: "",
    age: "",
    name: "",
    characteristics: "",
    lostLocation: "",
    lostDate: "",
    ownerPhone: "",
    reward: "",
    photo: "",
    neutered: "no",
  })

  const loadImage = (file: File) => {
    if (!file.type.startsWith("image/")) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setUploadedImage(result)
      setDetails((prev) => ({ ...prev, photo: result }))

      const img = new window.Image()
      img.onload = () => setImageDimensions({ width: img.width, height: img.height })
      img.src = result
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadImage(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadImage(file)
  }

  const handleRemoveImage = () => {
    setUploadedImage(null)
    setImageDimensions(null)
    setDetails((prev) => ({ ...prev, photo: "" }))
  }

  const handleInputChange = (field: keyof AnimalDetails, value: string) => {
    setDetails((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSearch = () => {
    if (isFormValid) {
      onPhotoUploaded(uploadedImage || "", details)
    }
  }

  // 업로드만 완료되면 바로 매칭을 허용해 전단지/추천을 볼 수 있도록 완화
  const isFormValid = Boolean(uploadedImage)

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={onBack} className="mb-8">
          <ArrowLeft className="w-5 h-5 mr-2" />
          뒤로가기
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="max-w-4xl w-full">
          <h2 className="text-3xl md:text-5xl font-bold text-center text-balance mb-4">
            {animalType === "dog" ? "강아지" : "고양이"} 정보를
            <span className="text-primary block">입력해주세요</span>
          </h2>

          <p className="text-lg text-muted-foreground text-center text-pretty mb-12">
            실종된 반려동물의 사진과 상세 정보를 입력하면 보호소 동물과 자동으로 매칭하고 전단지가 생성됩니다
          </p>

          {!uploadedImage ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">사진을 드래그하거나 클릭하세요</h3>
                  <p className="text-muted-foreground mb-4">JPG, PNG 파일 지원</p>
                </div>
                <div className="flex gap-3">
                  <Button asChild>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="w-5 h-5 mr-2" />
                      사진 선택
                      <input
                        id="file-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Image Preview */}
                <div
                  className="relative rounded-2xl overflow-hidden border-2 border-border bg-muted/20"
                  style={{ aspectRatio: imageDimensions ? `${imageDimensions.width} / ${imageDimensions.height}` : "4 / 5" }}
                >
                  <NextImage
                    src={uploadedImage || "/placeholder.svg"}
                    alt="Uploaded pet"
                    fill
                    sizes="(min-width: 768px) 400px, 100vw"
                    className="object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-4 right-4"
                    onClick={handleRemoveImage}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Form Fields */}
                <div className="space-y-4 max-h-96 overflow-y-auto pr-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">품종 *</label>
                    <input
                      type="text"
                      placeholder={animalType === "dog" ? "예: 리트리버" : "예: 페르시안"}
                      value={details.breed}
                      onChange={(e) => handleInputChange("breed", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">성별</label>
                    <select
                      value={details.gender}
                      onChange={(e) => handleInputChange("gender", e.target.value as "male" | "female" | "")}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    >
                      <option value="">선택 안 함</option>
                      <option value="male">수컷</option>
                      <option value="female">암컷</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">나이</label>
                    <input
                      type="text"
                      placeholder="예: 3살, 2개월"
                      value={details.age}
                      onChange={(e) => handleInputChange("age", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">중성화 유무</label>
                    <select
                      value={details.neutered}
                      onChange={(e) => handleInputChange("neutered", e.target.value as "yes" | "no")}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    >
                      <option value="no">미중성화</option>
                      <option value="yes">중성화</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">이름 *</label>
                    <input
                      type="text"
                      placeholder="동물의 이름"
                      value={details.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">특징 *</label>
                    <textarea
                      placeholder="색상, 무늬, 특이한 표시 등"
                      value={details.characteristics}
                      onChange={(e) => handleInputChange("characteristics", e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">실종 위치 *</label>
                    <input
                      type="text"
                      placeholder="예: 서울 강남구 테헤란로"
                      value={details.lostLocation}
                      onChange={(e) => handleInputChange("lostLocation", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">잃어버린 날짜</label>
                    <input
                      type="date"
                      value={details.lostDate}
                      onChange={(e) => handleInputChange("lostDate", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">주인 전화번호 *</label>
                    <input
                      type="tel"
                      placeholder="010-0000-0000"
                      value={details.ownerPhone}
                      onChange={(e) => handleInputChange("ownerPhone", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">사례금</label>
                    <input
                      type="text"
                      placeholder="예: 100만원, 협의 가능"
                      value={details.reward}
                      onChange={(e) => handleInputChange("reward", e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSearch}
                size="lg"
                className="w-full"
                disabled={!isFormValid}
              >
                보호소 동물과 매칭하기 + 전단지 생성
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
