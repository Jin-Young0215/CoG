"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Search, MapPin, HelpCircle } from "lucide-react"

interface HelpPageProps {
  onBack: () => void
}

const helpSections = [
  {
    icon: Search,
    title: "실종 동물 찾기",
    items: [
      {
        question: "어떻게 실종 동물을 찾나요?",
        answer:
          "메인 화면에서 '찾기' 버튼을 클릭하고, 강아지 또는 고양이를 선택한 후 실종 동물의 사진을 업로드하세요. AI가 자동으로 보호소의 동물들과 매칭해드립니다.",
      },
      {
        question: "어떤 사진을 올려야 하나요?",
        answer:
          "실종 동물의 얼굴이 선명하게 보이는 사진이 가장 좋습니다. 정면각도의 사진을 올리면 매칭 정확도가 높아집니다.",
      },
      {
        question: "매칭 결과는 얼마나 정확한가요?",
        answer:
          "AI 기술을 사용하여 90% 이상의 정확도로 유사한 동물을 찾아드립니다. 하지만 최종 확인은 직접 보호소를 방문하여 확인하시는 것을 권장합니다.",
      },
    ],
  },
  {
    icon: MapPin,
    title: "보호소 찾기",
    items: [
      {
        question: "주변 보호소는 어떻게 찾나요?",
        answer:
          "헤더의 '보호소 동물' 메뉴를 클릭하면 현재 위치를 기반으로 가까운 보호소 목록이 표시됩니다. 위치 권한을 허용해주세요.",
      },
      {
        question: "보호소 정보를 어떻게 확인하나요?",
        answer:
          "각 보호소 카드를 클릭하면 보호소의 주소, 연락처, 운영시간, 그리고 현재 보호 중인 동물들을 확인할 수 있습니다.",
      },
      {
        question: "보호소에 직접 방문해야 하나요?",
        answer: "네, 앱에서 매칭된 동물을 확인한 후 반드시 보호소를 직접 방문하여 확인하시기 바랍니다.",
      },
    ],
  },
  // 사진 업로드/개인정보 안내 섹션은 제거
]

export function HelpPage({ onBack }: HelpPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button onClick={onBack} variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            돌아가기
          </Button>
          <div className="text-center mb-8">
            <HelpCircle className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-foreground mb-4">도움말</h1>
            <p className="text-lg text-muted-foreground">COG 앱 사용에 대한 자주 묻는 질문들입니다</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {helpSections.map((section, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <section.icon className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">{section.title}</h2>
              </div>

              <div className="space-y-6">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="border-l-4 border-primary/30 pl-4">
                    <h3 className="text-lg font-semibold text-foreground mb-2">{item.question}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.answer}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <Card className="p-6 bg-primary/5 border-primary/20">
            <h2 className="text-xl font-bold text-foreground mb-4">추가 문의사항이 있으신가요?</h2>
            <p className="text-muted-foreground mb-4">
              위 내용으로 해결되지 않는 문제가 있다면 고객센터로 문의해주세요.
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                <span className="font-semibold">이메일:</span> dbswlsdud365@cau.ac.kr
              </p>
              <p className="text-muted-foreground">
                <span className="font-semibold">전화:</span> 010-4677-1373
              </p>
              <p className="text-muted-foreground">
                <span className="font-semibold">운영시간:</span> 평일 09:00 - 18:00
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
