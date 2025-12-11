import { Card, CardContent } from "@/components/ui/card"
import { Upload, Search, PawPrint } from "lucide-react"

const steps = [
  {
    step: "01",
    icon: Upload,
    title: "사진 업로드",
    description: "반려동물 사진을 올려주세요. 정면 사진이면 매칭 정확도가 올라갑니다.",
  },
  {
    step: "02",
    icon: Search,
    title: "AI 매칭 검색",
    description: "AI가 전국 동물보호소의 사진들과 비교하여 유사한 동물들을 찾아드립니다.",
  },
  {
    step: "03",
    icon: PawPrint,
    title: "재회 성공",
    description: "매칭된 결과를 확인하고 보호소에 연락하여 소중한 가족과 재회하세요.",
  },
]

export function HowItWorks() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">어떻게 작동하나요?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            간단한 3단계로 소중한 반려동물을 찾을 수 있습니다
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto items-stretch">
          {steps.map((step, index) => (
            <div key={index} className="text-center relative">
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-border -translate-x-1/2 z-0" />
              )}

              <Card className="relative z-10 h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-8 h-full flex flex-col gap-4">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                    <step.icon className="w-8 h-8 text-primary-foreground" />
                  </div>

                  <div className="text-sm font-bold text-primary mb-2">STEP {step.step}</div>

                  <h3 className="text-xl font-semibold mb-4">{step.title}</h3>

                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
