"use client"

import { Button } from "@/components/ui/button"
import { Upload, Search } from "lucide-react"

interface HeroSectionProps {
  onSearchClick: () => void
}

export function HeroSection({ onSearchClick }: HeroSectionProps) {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-balance mb-6">
            잃어버린 반려동물을
            <span className="text-primary block">다시 찾아드립니다</span>
          </h1>

          <p className="text-xl text-muted-foreground text-pretty mb-8 max-w-2xl mx-auto">
            AI 기술로 전국 동물보호소의 사진과 비교하여 소중한 가족을 빠르게 찾을 수 있도록 도와드립니다.
          </p>

          <div className="flex justify-center mb-12">
            <Button size="lg" className="text-lg px-8 py-6" onClick={onSearchClick}>
              <Search className="w-5 h-5 mr-2" />
              찾기
            </Button>
          </div>

          <div className="relative max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 text-center">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">사진을 업로드하세요</h3>
                <p className="text-muted-foreground">
                  실종된 반려동물의 사진을 올려주시면 전국 보호소와 비교해드립니다
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
