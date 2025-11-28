"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, MapPin, Calendar, Phone, Heart, Download, Printer, AlertCircle } from "lucide-react"
import Image from "next/image"
import html2canvas from "html2canvas"

interface RecommendationsPageProps {
  animalType: "dog" | "cat"
  uploadedImage: string
  uploadedDetails?: any
  onBack: () => void
}

interface SearchResult {
  desertion_no: string
  side: string
  similarity: number
  det_conf: number
  image_url: string
  kind_nm: string
  sex_cd: string
  age: string
  care_nm: string
  care_tel: string
  care_addr: string
}

interface SearchResponse {
  results: SearchResult[]
  query_bbox: {
    x1: number
    y1: number
    x2: number
    y2: number
    conf: number
  }
}

export function RecommendationsPage({ animalType, uploadedImage, uploadedDetails, onBack }: RecommendationsPageProps) {
  const [likedAnimals, setLikedAnimals] = useState<string[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [useBaseline, setUseBaseline] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    const runSearch = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: uploadedImage,
            mode: useBaseline ? "baseline" : "triplet",
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || "검색 실패")
        }
        const data = (await res.json()) as SearchResponse
        if (!cancelled) {
          setResults(data.results || [])
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "검색 중 오류가 발생했습니다.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (uploadedImage) {
      runSearch()
    }
    return () => {
      cancelled = true
    }
  }, [uploadedImage, useBaseline])

  const topMatches = useMemo(() => results.slice(0, 20), [results])

  const toggleLike = (id: string) => {
    setLikedAnimals((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleDownloadFlier = async () => {
    const flierElement = document.getElementById("flier-preview-mobile")
    if (flierElement) {
      try {
        const canvas = await html2canvas(flierElement, {
          backgroundColor: "#ffffff",
          scale: 2,
        })
        const link = document.createElement("a")
        link.href = canvas.toDataURL("image/png")
        link.download = `${uploadedDetails?.name || "found_pet"}_flyer.png`
        link.click()
      } catch (error) {
        console.error("플라이어 다운로드 실패:", error)
      }
    }
  }

  const handlePrintFlier = () => {
    const flierElement = document.getElementById("flier-preview-mobile")
    if (flierElement) {
      const printWindow = window.open("", "", "height=600,width=800")
      if (printWindow) {
        printWindow.document.write(flierElement.innerHTML)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  const renderSimilarity = (sim: number) => {
    const pct = Math.round(sim * 100)
    return `${pct}%`
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={onBack} className="mb-8">
          <ArrowLeft className="w-5 h-5 mr-2" />
          뒤로가기
        </Button>

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-balance mb-4">
              업로드한 사진과 비슷한
              <span className="text-primary"> {animalType === "dog" ? "강아지" : "고양이"} 20마리</span>
              를 찾았어요
            </h1>
            <p className="text-lg text-muted-foreground text-pretty">
              DB에 저장된 768차원 임베딩을 triplet head로 보정해 유사도 상위 20마리를 보여드립니다.
            </p>
          </div>

          <div className="grid lg:grid-cols-[350px_1fr_380px] gap-8 mb-12">
            {/* Left Sidebar - Uploaded Image */}
            <div className="space-y-4">
              <div className="sticky top-8 bg-card rounded-2xl p-6 border-2 border-border shadow-lg">
                <h3 className="font-bold text-lg mb-4">업로드한 사진</h3>
                <Image
                  src={uploadedImage || "/placeholder.svg"}
                  alt="Uploaded pet"
                  width={300}
                  height={300}
                  className="w-full h-auto rounded-lg mb-4 object-cover"
                />
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">분석된 품종</p>
                    <p className="font-bold text-primary">
                      {uploadedDetails?.breed || (animalType === "dog" ? "강아지" : "고양이")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">나이</p>
                    <p className="font-bold">{uploadedDetails?.age || "미입력"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">특징</p>
                    <p className="font-bold">{uploadedDetails?.characteristics || "미입력"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">실종 위치</p>
                    <p className="font-bold">{uploadedDetails?.lostLocation || "미입력"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle - Matched Animals (Top 20) */}
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-bold">유사도 상위 20개 결과</h2>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    {useBaseline ? "베이스라인(DINO 코사인)" : "triplet head(768) 기준"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUseBaseline((v) => !v)}
                    className="bg-transparent"
                  >
                    {useBaseline ? "튜닝 모델로 보기" : "베이스라인으로 보기"}
                  </Button>
                </div>
              </div>

              {loading && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <span className="animate-spin border-2 border-primary border-t-transparent rounded-full w-4 h-4" />
                  검색 중입니다...
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && topMatches.length === 0 && (
                <div className="text-muted-foreground">결과가 없습니다.</div>
              )}

              {topMatches.map((animal, index) => (
                <Card
                  key={`${animal.desertion_no}-${animal.side}`}
                  className="p-6 hover:shadow-xl transition-all duration-300 border-2 overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-primary to-primary/50" />

                  <div className="grid md:grid-cols-[220px_1fr] gap-6">
                    <div className="relative">
                      <div className="relative rounded-xl overflow-hidden">
                        <Image
                          src={animal.image_url || "/placeholder.svg"}
                          alt={animal.desertion_no}
                          width={220}
                          height={220}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute top-3 left-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-bold">
                          #{index + 1}
                        </div>
                        <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                          {renderSimilarity(animal.similarity)} 유사
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute bottom-3 right-3 bg-white/90 hover:bg-white rounded-full"
                        onClick={() => toggleLike(animal.desertion_no)}
                      >
                        <Heart
                          className={`w-5 h-5 ${likedAnimals.includes(animal.desertion_no) ? "fill-red-500 text-red-500" : ""}`}
                        />
                      </Button>
                    </div>

                    <div className="flex flex-col justify-between">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-3xl font-bold mb-2">공고번호 {animal.desertion_no}</h3>
                          <div className="flex flex-wrap gap-3 text-sm font-medium">
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full">
                              {animal.kind_nm || "품종 정보 없음"}
                            </span>
                            <span className="bg-muted px-3 py-1 rounded-full">{animal.age || "나이 미상"}</span>
                            <span className="bg-muted px-3 py-1 rounded-full">
                              {animal.sex_cd === "M" ? "수컷" : animal.sex_cd === "F" ? "암컷" : "성별 미상"}
                            </span>
                          </div>
                        </div>

                        <p className="text-muted-foreground leading-relaxed">
                          보호소: {animal.care_nm || "정보 없음"} / {animal.care_addr || "주소 정보 없음"}
                        </p>

                        <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
                          <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                            <div>
                              <p className="font-bold">{animal.care_nm || "보호소 정보 없음"}</p>
                              <p className="text-sm text-muted-foreground">{animal.care_addr || "주소 정보 없음"}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-2 border-t border-border">
                            <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                            <p className="font-bold text-lg">{animal.care_tel || "전화 정보 없음"}</p>
                          </div>

                          <div className="flex items-center gap-3 pt-2 border-t border-border">
                            <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                            <p className="text-sm">사진 측정 신뢰도 {Math.round(animal.det_conf * 100)}%</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-6">
                        <Button className="flex-1 bg-primary hover:bg-primary/90">보호소 정보 보기</Button>
                        <Button variant="outline" className="flex-1 bg-transparent">
                          보호소 전화 연결
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Right Sidebar - Flier Preview */}
            {uploadedDetails && (
              <div className="space-y-4">
                <div className="sticky top-8 bg-white rounded-2xl p-4 border-4 border-red-500 shadow-lg max-h-[600px] overflow-y-auto">
                  <div id="flier-preview-mobile" className="bg-white rounded-lg p-6">
                    <div className="text-center mb-4">
                      <h1 className="text-3xl font-bold text-red-600 mb-2">찾아주세요</h1>
                      <p className="text-sm font-semibold text-gray-700">
                        {animalType === "dog" ? "실종 강아지" : "실종 고양이"}를 찾습니다
                      </p>
                    </div>

                    {uploadedDetails.photo && (
                      <div className="flex justify-center mb-4">
                        <img
                          src={uploadedDetails.photo || "/placeholder.svg"}
                          alt="실종 동물"
                          className="w-40 h-40 object-cover rounded-lg border-2 border-gray-300"
                        />
                      </div>
                    )}

                    <div className="bg-gray-50 p-4 rounded-lg mb-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="font-semibold">품종:</span>
                        <span>{uploadedDetails.breed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">성별:</span>
                        <span>{uploadedDetails.gender === "male" ? "수컷" : "암컷"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">나이:</span>
                        <span>{uploadedDetails.age}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">이름:</span>
                        <span>{uploadedDetails.name}</span>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4 text-xs">
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">특징</p>
                        <p className="text-gray-900 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                          {uploadedDetails.characteristics}
                        </p>
                      </div>

                      <div>
                        <p className="font-semibold text-gray-600 mb-1">실종 위치</p>
                        <p className="text-gray-900 bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                          📍 {uploadedDetails.lostLocation}
                        </p>
                      </div>

                      <div className="bg-red-50 p-3 rounded border-2 border-red-300">
                        <div className="flex justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-gray-600 text-xs">보호자 연락처</p>
                            <p className="font-bold text-red-600">{uploadedDetails.ownerPhone}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-600 text-xs">사례금</p>
                            <p className="font-bold text-red-600">{uploadedDetails.reward || "협의"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-center text-xs text-gray-600 border-t border-gray-300 pt-2">
                      발견 시 바로 연락 부탁드립니다.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 mt-4">
                    <Button onClick={handleDownloadFlier} className="w-full text-xs gap-2" size="sm">
                      <Download className="w-4 h-4" />
                      다운로드
                    </Button>
                    <Button onClick={handlePrintFlier} variant="outline" className="w-full text-xs gap-2 bg-transparent" size="sm">
                      <Printer className="w-4 h-4" />
                      인쇄
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
