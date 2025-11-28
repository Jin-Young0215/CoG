import { Card, CardContent } from "@/components/ui/card"
import { Zap, Shield, Clock, Users } from "lucide-react"

const features = [
  {
    icon: Zap,
    title: "AI 매칭 기술",
    description: "최신 AI 기술로 빠르고 정확한 동물 매칭을 제공합니다",
  },
  {
    icon: Shield,
    title: "안전한 정보 보호",
    description: "개인정보와 반려동물 정보를 안전하게 보호합니다",
  },
  {
    icon: Clock,
    title: "24시간 모니터링",
    description: "전국 보호소 정보를 실시간으로 업데이트합니다",
  },
  {
    icon: Users,
    title: "커뮤니티 지원",
    description: "많은 사람들이 함께 도와주는 따뜻한 커뮤니티입니다",
  },
]

export function FeatureCards() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">왜 COG를 선택해야 할까요?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            첨단 기술과 따뜻한 마음으로 소중한 가족을 찾아드립니다
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
