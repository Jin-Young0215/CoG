"use client"

import { Button } from "@/components/ui/button"
import { Dog, Cat, ArrowLeft } from "lucide-react"

interface SearchSelectionProps {
  onBack: () => void
  onSelect: (type: "dog" | "cat") => void
}

export function SearchSelection({ onBack, onSelect }: SearchSelectionProps) {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={onBack} className="mb-8">
          <ArrowLeft className="w-5 h-5 mr-2" />
          뒤로가기
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full">
          <h2 className="text-3xl md:text-5xl font-bold text-center text-balance mb-4">
            어떤 반려동물을
            <span className="text-primary block">찾고 계신가요?</span>
          </h2>

          <p className="text-lg text-muted-foreground text-center text-pretty mb-12">
            찾고 계신 반려동물의 종류를 선택해주세요
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => onSelect("dog")}
              className="group bg-card border-2 border-border hover:border-primary rounded-2xl p-12 transition-all hover:shadow-xl"
            >
              <Dog className="w-20 h-20 text-primary mx-auto mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-bold mb-2">강아지 찾기</h3>
              <p className="text-muted-foreground">실종된 강아지를 찾아드립니다</p>
            </button>

            <button
              onClick={() => onSelect("cat")}
              className="group bg-card border-2 border-border hover:border-primary rounded-2xl p-12 transition-all hover:shadow-xl"
            >
              <Cat className="w-20 h-20 text-primary mx-auto mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-bold mb-2">고양이 찾기</h3>
              <p className="text-muted-foreground">실종된 고양이를 찾아드립니다</p>
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
