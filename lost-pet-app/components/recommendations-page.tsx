"use client"

import type { CSSProperties } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, MapPin, Calendar, Phone, AlertCircle, Printer, Download } from "lucide-react"
import Image from "next/image"
import html2canvas from "html2canvas"

interface RecommendationsPageProps {
  animalType: "dog" | "cat"
  uploadedImage: string
  uploadedDetails?: any
  onBack: () => void
  onOpenShelter?: (info: { name: string | null; address: string | null; phone: string | null }) => void
}

interface SearchResult {
  desertion_no: string
  side: string
  similarity: number
  image_url: string
  up_kind_cd?: string
  kind_nm: string
  sex_cd: string
  age: string
  neuter_yn?: string
  care_nm: string
  care_tel: string
  care_addr: string
  notice_sdt?: string
  special_mark?: string
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

export function RecommendationsPage({
  animalType,
  uploadedImage,
  uploadedDetails,
  onBack,
  onOpenShelter,
}: RecommendationsPageProps) {
  const flierRef = useRef<HTMLDivElement | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const runSearch = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            imageBase64: uploadedImage,
            animalType,
            gender: uploadedDetails?.gender,
            lostDate: uploadedDetails?.lostDate,
            mode: "triplet",
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
  }, [uploadedImage])

  const topMatches = useMemo(() => results.slice(0, 20), [results])

  const getFlierElement = () => flierRef.current

  const waitForImages = async (root: HTMLElement) => {
    const imgs = Array.from(root.querySelectorAll("img"))
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve()
            img.onload = () => resolve()
            img.onerror = () => resolve()
          }),
      ),
    )
  }

  const renderFlierCanvas = async () => {
    const flierElement = getFlierElement()
    if (!flierElement) throw new Error("전단지 요소를 찾지 못했습니다.")

    await waitForImages(flierElement)

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const fallbackVars: Record<string, string> = {
      "--background": "#ffffff",
      "--foreground": "#111827",
      "--card": "#ffffff",
      "--card-foreground": "#111827",
      "--popover": "#ffffff",
      "--popover-foreground": "#111827",
      "--primary": "#dc2626",
      "--primary-foreground": "#ffffff",
      "--secondary": "#f3f4f6",
      "--secondary-foreground": "#111827",
      "--muted": "#f3f4f6",
      "--muted-foreground": "#4b5563",
      "--accent": "#f3f4f6",
      "--accent-foreground": "#111827",
      "--destructive": "#ef4444",
      "--destructive-foreground": "#111827",
      "--border": "#e5e7eb",
      "--input": "#e5e7eb",
      "--ring": "#ef4444",
    }

    return html2canvas(flierElement, {
      backgroundColor: "#ffffff",
      scale: dpr,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      onclone: (doc) => {
        Object.entries(fallbackVars).forEach(([key, value]) => {
          doc.documentElement.style.setProperty(key, value)
        })
        doc.body.style.backgroundColor = "#ffffff"
        doc.querySelectorAll(".capture-hidden").forEach((el) => {
          ;(el as HTMLElement).style.display = "none"
        })
      },
    })
  }

  const openPrintDialog = async () => {
    if (isPrinting || !uploadedDetails) return
    setPreviewLoading(true)
    setShowPrintDialog(true)
    try {
      const canvas = await renderFlierCanvas()
      if (!canvas) throw new Error("미리보기 캔버스 생성 실패")
      setPreviewDataUrl(canvas.toDataURL("image/png"))
    } catch (err) {
      console.error("전단지 미리보기 생성 실패:", err)
      alert("미리보기를 준비하지 못했습니다. 화면이 모두 로드된 뒤 다시 시도해주세요.")
      setShowPrintDialog(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handlePrintFlier = async () => {
    if (isPrinting) return
    const printWindow = window.open("", "_blank", "height=900,width=700")
    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.")
      return
    }

    setIsPrinting(true)
    try {
      const dataUrl =
        previewDataUrl ||
        (await renderFlierCanvas().then((canvas) => canvas.toDataURL("image/png")))

      printWindow.document.write(`
        <html>
          <head>
            <style>
              @page { size: A4; margin: 0; }
              html, body {
                margin: 0;
                padding: 0;
                width: 210mm;
                height: 297mm;
                display: flex;
                align-items: center;
                justify-content: center;
                background: white;
              }
              img {
                width: 95%;
                max-height: 95%;
                height: auto;
                object-fit: contain;
                display: block;
                margin: auto;
              }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" />
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.focus()
        printWindow.print()
        printWindow.onafterprint = () => printWindow.close()
      }
    } catch (err) {
      console.error("플라이어 인쇄 실패:", err)
      alert("전단지 인쇄 준비 중 오류가 발생했습니다.")
      printWindow.close()
    } finally {
      setIsPrinting(false)
      setShowPrintDialog(false)
    }
  }

  const handleDownloadFlier = async () => {
    if (isPrinting) return
    setIsPrinting(true)
    try {
      const dataUrl =
        previewDataUrl ||
        (await renderFlierCanvas().then((canvas) => canvas.toDataURL("image/png")))

      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `${uploadedDetails?.name || "found_pet"}_flier.png`
      link.click()
    } catch (err) {
      console.error("플라이어 다운로드 실패:", err)
      alert("전단지 다운로드에 실패했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsPrinting(false)
      setShowPrintDialog(false)
    }
  }

  const renderSimilarity = (sim: number) => {
    const pct = Math.round(sim * 100)
    return `${pct}%`
  }

  const displayOrNA = (value?: string) => (value && value.trim() ? value : "미입력")

  const renderGender = (gender?: string) => {
    if (gender === "male") return "수컷"
    if (gender === "female") return "암컷"
    return "미입력"
  }

  const flierThemeVars: CSSProperties = {
    "--background": "#ffffff",
    "--foreground": "#111827",
    "--card": "#ffffff",
    "--card-foreground": "#111827",
    "--popover": "#ffffff",
    "--popover-foreground": "#111827",
    "--primary": "#dc2626",
    "--primary-foreground": "#ffffff",
    "--secondary": "#f3f4f6",
    "--secondary-foreground": "#111827",
    "--muted": "#f3f4f6",
    "--muted-foreground": "#4b5563",
    "--accent": "#f3f4f6",
    "--accent-foreground": "#111827",
    "--destructive": "#ef4444",
    "--destructive-foreground": "#111827",
    "--border": "#e5e7eb",
    "--input": "#e5e7eb",
    "--ring": "#ef4444",
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
            </p>
          </div>

          <div className="grid lg:grid-cols-[380px_1fr] gap-8 mb-12">
            {/* Left Sidebar - Uploaded Image + Flier */}
            <div className="space-y-6">
              <div className="bg-card rounded-2xl p-6 border-2 border-border shadow-lg">
                <h3 className="font-bold text-lg mb-4">업로드한 사진</h3>
                <Image
                  src={uploadedImage || "/placeholder.svg"}
                  alt="Uploaded pet"
                  width={300}
                  height={300}
                  className="w-full h-auto rounded-lg mb-4 object-contain"
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
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">실종 날짜</p>
                    <p className="font-bold">{uploadedDetails?.lostDate || "미입력"}</p>
                  </div>
                </div>
              </div>

              {uploadedDetails && (
                <div
                  className="bg-white rounded-2xl p-4 border-4 shadow-lg"
                  style={{ borderColor: "#ef4444", backgroundColor: "#ffffff", ...flierThemeVars }}
                >
                  <div
                    id="flier-preview-mobile"
                    ref={flierRef}
                    className="bg-white rounded-lg p-6 mx-auto w-full max-w-md"
                    style={{ backgroundColor: "#ffffff", color: "#111827", borderColor: "#e5e7eb", ...flierThemeVars }}
                  >
                    <div className="text-center mb-4">
                      <h1 className="text-3xl font-bold mb-2" style={{ color: "#dc2626" }}>
                        찾아주세요
                      </h1>
                      <p className="text-sm font-semibold" style={{ color: "#374151" }}>
                        {animalType === "dog" ? "실종 강아지" : "실종 고양이"}를 찾습니다
                      </p>
                    </div>

                    {uploadedDetails.photo && (
                      <div className="flex justify-center mb-4">
                        <img
                          src={uploadedDetails.photo || "/placeholder.svg"}
                          alt="실종 동물"
                          crossOrigin="anonymous"
                          className="w-40 h-40 object-cover rounded-lg border-2"
                          style={{ borderColor: "#d1d5db", backgroundColor: "#ffffff" }}
                        />
                      </div>
                    )}

                    <div
                      className="p-4 rounded-lg mb-4 text-sm space-y-2"
                      style={{ backgroundColor: "#f9fafb", color: "#111827" }}
                    >
                      <div className="flex justify-between">
                        <span className="font-semibold">품종:</span>
                        <span>{displayOrNA(uploadedDetails.breed)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">성별:</span>
                        <span>{renderGender(uploadedDetails.gender)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">나이:</span>
                        <span>{displayOrNA(uploadedDetails.age)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">잃어버린 날짜:</span>
                        <span>{uploadedDetails.lostDate || "미입력"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold">이름:</span>
                        <span>{displayOrNA(uploadedDetails.name)}</span>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4 text-xs">
                      <div>
                        <p className="font-semibold mb-1" style={{ color: "#4b5563" }}>
                          특징
                        </p>
                        <p
                          className="p-2 rounded border-l-4"
                          style={{ backgroundColor: "#fefce8", borderColor: "#facc15", color: "#111827" }}
                        >
                          {displayOrNA(uploadedDetails.characteristics)}
                        </p>
                      </div>

                      <div>
                        <p className="font-semibold mb-1" style={{ color: "#4b5563" }}>
                          실종 위치
                        </p>
                        <p
                          className="p-2 rounded border-l-4"
                          style={{ backgroundColor: "#eff6ff", borderColor: "#60a5fa", color: "#111827" }}
                        >
                          📍 {displayOrNA(uploadedDetails.lostLocation)}
                        </p>
                      </div>

                      <div
                        className="p-3 rounded border-2"
                        style={{ backgroundColor: "#fef2f2", borderColor: "#fca5a5", color: "#b91c1c" }}
                      >
                        <div className="flex justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-xs" style={{ color: "#4b5563" }}>
                              보호자 연락처
                            </p>
                            <p className="font-bold" style={{ color: "#b91c1c" }}>
                              {displayOrNA(uploadedDetails.ownerPhone)}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-xs" style={{ color: "#4b5563" }}>
                              사례금
                            </p>
                            <p className="font-bold" style={{ color: "#b91c1c" }}>
                              {displayOrNA(uploadedDetails.reward)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={openPrintDialog}
                      disabled={isPrinting || previewLoading}
                      className="w-full mt-4 capture-hidden"
                      variant="outline"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      전단지 인쇄/저장
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Middle - Matched Animals (Top 20) */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">유사도 상위 20개 결과</h2>

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
                    </div>

                    <div className="flex flex-col justify-between">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-3xl font-bold mb-2">{animal.kind_nm || "품종 정보 없음"}</h3>
                          <div className="flex flex-wrap gap-3 text-sm font-medium">
                            <span className="bg-muted px-3 py-1 rounded-full">{animal.age || "나이 미상"}</span>
                            <span className="bg-muted px-3 py-1 rounded-full">
                              {animal.sex_cd === "M" ? "수컷" : animal.sex_cd === "F" ? "암컷" : "성별 미상"}
                            </span>
                            <span className="bg-muted px-3 py-1 rounded-full">
                              {animal.neuter_yn === "Y"
                                ? "중성화"
                                : animal.neuter_yn === "N"
                                  ? "미중성화"
                                  : "중성화 정보 없음"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground leading-relaxed">
                          <p className="text-foreground">특징: {animal.special_mark || "특징 정보 없음"}</p>
                          <p>공고 시작일: {animal.notice_sdt || "정보 없음"}</p>
                        </div>

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
                        </div>
                      </div>

                      <div className="pt-6">
                        <Button
                          className="w-full bg-primary hover:bg-primary/90"
                          onClick={() =>
                            onOpenShelter?.({
                              name: animal.care_nm || null,
                              address: animal.care_addr || null,
                              phone: animal.care_tel || null,
                            })
                          }
                        >
                          보호소 정보 보기
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

          </div>
        </div>
      </div>

      {showPrintDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <p className="text-sm text-muted-foreground">전단지 내보내기</p>
                <h3 className="text-xl font-bold">인쇄 또는 이미지로 저장</h3>
              </div>
              <Button variant="ghost" onClick={() => setShowPrintDialog(false)} disabled={isPrinting}>
                닫기
              </Button>
            </div>

            <div className="grid md:grid-cols-[360px_1fr] gap-6 p-6">
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handlePrintFlier}
                  disabled={isPrinting || previewLoading}
                  className="w-full"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  인쇄하기
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadFlier}
                  disabled={isPrinting || previewLoading}
                  className="w-full bg-transparent"
                >
                  <Download className="w-4 h-4 mr-2" />
                  이미지로 다운로드
                </Button>
                <p className="text-xs text-muted-foreground">
                  인쇄 시 브라우저 인쇄 대화상자가 열립니다. 저장을 선택하면 PNG로 내려받습니다.
                </p>
              </div>

              <div className="bg-muted/40 rounded-xl p-4 min-h-[320px] flex items-center justify-center">
                {previewLoading && <span className="text-muted-foreground text-sm">미리보기 생성 중...</span>}
                {!previewLoading && previewDataUrl && (
                  <img
                    src={previewDataUrl}
                    alt="전단지 미리보기"
                    className="rounded-lg border shadow max-h-[520px] w-full object-contain bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
