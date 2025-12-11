"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, X, Search } from "lucide-react"

export function UploadSection() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSearch = () => {
    setIsSearching(true)
    // 실제 검색 로직은 여기에 구현
    setTimeout(() => {
      setIsSearching(false)
      // 검색 결과 페이지로 이동하는 로직
    }, 2000)
  }

  const removeImage = () => {
    setUploadedImage(null)
  }

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">실종동물 찾기</h2>
          <p className="text-muted-foreground">사진을 업로드하면 전국 보호소의 동물들과 비교해드립니다</p>
        </div>

        <Card>
          <CardContent className="p-8">
            {!uploadedImage ? (
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 text-center">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">사진을 업로드하세요</h3>
                <p className="text-muted-foreground mb-6">JPG, PNG 파일을 지원합니다 (최대 10MB)</p>
                <label htmlFor="image-upload">
                  <Button asChild>
                    <span>파일 선택</span>
                  </Button>
                </label>
                <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative">
                  <img
                    src={uploadedImage || "/placeholder.svg"}
                    alt="업로드된 반려동물 사진"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <Button variant="destructive" size="icon" className="absolute top-2 right-2" onClick={removeImage}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <Button onClick={handleSearch} disabled={isSearching} className="w-full" size="lg">
                  {isSearching ? (
                    <>검색 중...</>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      보호소 동물과 비교하기
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
