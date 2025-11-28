"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, Printer } from "lucide-react"
import html2canvas from "html2canvas"

interface FlierData {
  animalType: "dog" | "cat"
  breed: string
  gender: "male" | "female"
  age: string
  name: string
  characteristics: string
  lostLocation: string
  ownerPhone: string
  reward: string
  photo: string | null
}

interface FlierGeneratorProps {
  onBack: () => void
}

export function FlierGenerator({ onBack }: FlierGeneratorProps) {
  const [formData, setFormData] = useState<FlierData>({
    animalType: "dog",
    breed: "",
    gender: "male",
    age: "",
    name: "",
    characteristics: "",
    lostLocation: "",
    ownerPhone: "",
    reward: "",
    photo: null,
  })

  const [flierGenerated, setFlierGenerated] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          photo: reader.result as string,
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleGenerateFlier = () => {
    if (!formData.breed || !formData.name || !formData.lostLocation || !formData.ownerPhone) {
      alert("필수 정보를 모두 입력해주세요.")
      return
    }
    setFlierGenerated(true)
  }

  const handleDownloadFlier = async () => {
    const flierElement = document.getElementById("flier-preview")
    if (flierElement) {
      try {
        const canvas = await html2canvas(flierElement, {
          backgroundColor: "#ffffff",
          scale: 2,
        })
        const link = document.createElement("a")
        link.href = canvas.toDataURL("image/png")
        link.download = `${formData.name}_전단지.png`
        link.click()
      } catch (error) {
        console.error("전단지 다운로드 실패:", error)
      }
    }
  }

  const handlePrintFlier = () => {
    const flierElement = document.getElementById("flier-preview")
    if (flierElement) {
      const printWindow = window.open("", "", "height=600,width=800")
      if (printWindow) {
        printWindow.document.write(flierElement.innerHTML)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  if (flierGenerated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
        <div className="container mx-auto px-4">
          <button
            onClick={() => setFlierGenerated(false)}
            className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            수정하기
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 전단지 미리보기 */}
            <div className="lg:col-span-2">
              <div
                id="flier-preview"
                className="bg-white rounded-lg shadow-lg p-8 border-4 border-red-500 max-w-2xl mx-auto"
              >
                <div className="text-center mb-6">
                  <h1 className="text-4xl font-bold text-red-600 mb-2">🚨 실종 동물 찾습니다 🚨</h1>
                  <p className="text-lg font-semibold text-gray-700">
                    {formData.animalType === "dog" ? "강아지" : "고양이"} 찾기
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  {/* 사진 */}
                  {formData.photo && (
                    <div className="col-span-2 flex justify-center">
                      <img
                        src={formData.photo || "/placeholder.svg"}
                        alt="실종 동물"
                        className="w-64 h-64 object-cover rounded-lg border-2 border-gray-300"
                      />
                    </div>
                  )}

                  {/* 정보 */}
                  <div className="col-span-2 bg-gray-50 p-6 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-600">견종/묘종</p>
                        <p className="text-lg font-bold text-gray-900">{formData.breed}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">성별</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formData.gender === "male" ? "수컷" : "암컷"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">나이</p>
                        <p className="text-lg font-bold text-gray-900">{formData.age}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">이름</p>
                        <p className="text-lg font-bold text-gray-900">{formData.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* 특징 */}
                  <div className="col-span-2">
                    <p className="text-sm font-semibold text-gray-600 mb-2">특징</p>
                    <p className="text-base text-gray-900 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                      {formData.characteristics}
                    </p>
                  </div>

                  {/* 실종 위치 */}
                  <div className="col-span-2">
                    <p className="text-sm font-semibold text-gray-600 mb-2">실종 위치</p>
                    <p className="text-base text-gray-900 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                      📍 {formData.lostLocation}
                    </p>
                  </div>

                  {/* 연락처 및 사례금 */}
                  <div className="col-span-2 bg-red-50 p-6 rounded-lg border-2 border-red-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-600">주인 전화번호</p>
                        <p className="text-2xl font-bold text-red-600">{formData.ownerPhone}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600">사례금</p>
                        <p className="text-2xl font-bold text-red-600">{formData.reward}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-600 border-t-2 border-gray-300 pt-4">
                  <p>발견 시 위의 전화번호로 연락 부탁드립니다.</p>
                  <p>감사합니다.</p>
                </div>
              </div>
            </div>

            {/* 다운로드/인쇄 버튼 */}
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
                <h3 className="text-lg font-bold text-foreground mb-4">전단지 저장</h3>
                <div className="flex flex-col gap-3">
                  <Button onClick={handleDownloadFlier} className="w-full gap-2">
                    <Download className="w-4 h-4" />
                    이미지로 다운로드
                  </Button>
                  <Button onClick={handlePrintFlier} variant="outline" className="w-full gap-2 bg-transparent">
                    <Printer className="w-4 h-4" />
                    인쇄하기
                  </Button>
                  <Button onClick={() => setFlierGenerated(false)} variant="ghost" className="w-full">
                    다시 작성
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
      <div className="container mx-auto px-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          돌아가기
        </button>

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">실종 동물 전단지 생성</h1>
            <p className="text-muted-foreground mb-8">아래 정보를 입력하면 자동으로 전단지가 생성됩니다.</p>

            <form className="space-y-6">
              {/* 동물 종류 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  동물 종류 <span className="text-red-500">*</span>
                </label>
                <select
                  name="animalType"
                  value={formData.animalType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="dog">강아지</option>
                  <option value="cat">고양이</option>
                </select>
              </div>

              {/* 사진 업로드 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  동물 사진 <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-input"
                  />
                  <label htmlFor="photo-input" className="cursor-pointer">
                    {formData.photo ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={formData.photo || "/placeholder.svg"}
                          alt="미리보기"
                          className="w-32 h-32 object-cover rounded-lg"
                        />
                        <p className="text-sm text-muted-foreground">클릭하여 다른 사진 선택</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">사진을 업로드하세요</p>
                        <p className="text-sm text-muted-foreground">클릭하거나 드래그 앤 드롭</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* 견종/묘종 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  견종/묘종 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="breed"
                  value={formData.breed}
                  onChange={handleInputChange}
                  placeholder="예: 리트리버, 페르시안 고양이"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 성별 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">성별</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="male">수컷</option>
                  <option value="female">암컷</option>
                </select>
              </div>

              {/* 나이 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">나이</label>
                <input
                  type="text"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  placeholder="예: 3살, 2개월"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 이름 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="동물의 이름"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 특징 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">특징</label>
                <textarea
                  name="characteristics"
                  value={formData.characteristics}
                  onChange={handleInputChange}
                  placeholder="색상, 무늬, 특이한 표시 등 특징을 자세히 설명해주세요"
                  rows={4}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* 실종 위치 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  실종 위치 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lostLocation"
                  value={formData.lostLocation}
                  onChange={handleInputChange}
                  placeholder="예: 서울시 강남구 테헤란로 123번지 근처"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 주인 전화번호 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  주인 전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="ownerPhone"
                  value={formData.ownerPhone}
                  onChange={handleInputChange}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 사례금 */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">사례금</label>
                <input
                  type="text"
                  name="reward"
                  value={formData.reward}
                  onChange={handleInputChange}
                  placeholder="예: 100만원, 협의 가능"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-6">
                <Button onClick={handleGenerateFlier} className="flex-1">
                  전단지 생성하기
                </Button>
                <Button onClick={onBack} variant="outline" className="flex-1 bg-transparent">
                  취소
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
