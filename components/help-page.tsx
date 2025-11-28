"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Search, Upload, MapPin, Bell, Shield, HelpCircle } from "lucide-react"

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
          "실종 동물의 얼굴이 선명하게 보이는 사진이 가장 좋습니다. 여러 각도의 사진을 올리면 매칭 정확도가 높아집니다.",
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
  {
    icon: Upload,
    title: "사진 업로드",
    items: [
      {
        question: "사진 업로드가 안 돼요",
        answer:
          "JPG, PNG 형식의 이미지 파일만 업로드 가능합니다. 파일 크기는 10MB 이하여야 합니다. 브라우저의 카메라 권한을 확인해주세요.",
      },
      {
        question: "여러 장의 사진을 올릴 수 있나요?",
        answer: "네, 한 번에 최대 5장까지 업로드할 수 있습니다. 다양한 각도의 사진을 올리면 매칭 정확도가 높아집니다.",
      },
      {
        question: "업로드한 사진은 어떻게 관리되나요?",
        answer:
          "업로드된 사진은 암호화되어 안전하게 저장되며, 매칭 목적으로만 사용됩니다. 개인정보 보호 정책을 준수합니다.",
      },
    ],
  },
  {
    icon: Bell,
    title: "알림 설정",
    items: [
      {
        question: "알림은 어떻게 받나요?",
        answer:
          "회원가입 후 알림 설정을 활성화하면 매칭된 동물이 발견되었을 때 즉시 알림을 받을 수 있습니다. 푸시 알림 권한을 허용해주세요.",
      },
      {
        question: "알림을 끄고 싶어요",
        answer: "마이페이지의 설정에서 알림을 끄거나 켤 수 있습니다. 알림 종류별로 세부 설정도 가능합니다.",
      },
    ],
  },
  {
    icon: Shield,
    title: "개인정보 보호",
    items: [
      {
        question: "내 정보는 안전한가요?",
        answer:
          "모든 개인정보는 암호화되어 저장되며, 관련 법규를 준수합니다. 제3자에게 정보를 제공하지 않으며, 오직 실종 동물 찾기 목적으로만 사용됩니다.",
      },
      {
        question: "계정을 삭제하고 싶어요",
        answer: "마이페이지의 설정에서 계정 삭제를 요청할 수 있습니다. 삭제 시 모든 데이터가 영구적으로 삭제됩니다.",
      },
    ],
  },
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
                <span className="font-semibold">이메일:</span> support@cog.app
              </p>
              <p className="text-muted-foreground">
                <span className="font-semibold">전화:</span> 1588-0000
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
