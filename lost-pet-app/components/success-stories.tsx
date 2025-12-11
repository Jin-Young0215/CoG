"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Calendar, MapPin } from "lucide-react"
import Image from "next/image"

interface SuccessStoriesProps {
  onBack: () => void
}

const successStories = [
  {
    id: 1,
    petName: "뽀삐",
    petType: "강아지",
    breed: "말티즈",
    image: "/cute-brown-dog-at-shelter.jpg",
    lostDate: "2024년 1월 5일",
    foundDate: "2024년 1월 12일",
    location: "서울시 강남구",
    story:
      "뽀삐는 산책 중 놀라서 도망갔어요. COG 앱으로 사진을 올렸고, 7일 만에 강남구 보호소에서 찾을 수 있었습니다. 정말 감사합니다!",
    owner: "김민지",
  },
  {
    id: 2,
    petName: "나비",
    petType: "고양이",
    breed: "코리안 숏헤어",
    image: "/orange-tabby-cat-at-shelter.jpg",
    lostDate: "2024년 2월 14일",
    foundDate: "2024년 2월 20일",
    location: "부산시 해운대구",
    story:
      "창문을 통해 나간 나비를 찾지 못해 너무 걱정했어요. COG 덕분에 해운대 보호소에서 무사히 찾았습니다. 정말 고마워요!",
    owner: "이서연",
  },
  {
    id: 3,
    petName: "초코",
    petType: "강아지",
    breed: "골든 리트리버",
    image: "/golden-retriever-at-shelter.jpg",
    lostDate: "2024년 3월 2일",
    foundDate: "2024년 3월 8일",
    location: "인천시 남동구",
    story:
      "초코가 집 앞에서 사라졌을 때 정말 당황했어요. COG 앱의 AI 매칭 기능으로 빠르게 찾을 수 있었습니다. 최고의 앱입니다!",
    owner: "박준호",
  },
  {
    id: 4,
    petName: "루루",
    petType: "고양이",
    breed: "페르시안",
    image: "/white-persian-cat-at-shelter.jpg",
    lostDate: "2024년 3월 15일",
    foundDate: "2024년 3월 18일",
    location: "대구시 수성구",
    story: "루루가 밖으로 나간 지 3일 만에 찾았어요. COG의 위치 기반 보호소 검색이 정말 유용했습니다. 감사합니다!",
    owner: "최유진",
  },
  {
    id: 5,
    petName: "바둑이",
    petType: "강아지",
    breed: "믹스견",
    image: "/black-dog-at-shelter.jpg",
    lostDate: "2024년 4월 1일",
    foundDate: "2024년 4월 10일",
    location: "경기도 성남시",
    story:
      "바둑이를 잃어버렸을 때 정말 힘들었어요. COG 앱으로 여러 보호소를 확인하고 드디어 찾았습니다. 정말 감사드립니다!",
    owner: "정민수",
  },
  {
    id: 6,
    petName: "구름이",
    petType: "강아지",
    breed: "비숑 프리제",
    image: "/white-fluffy-dog-at-shelter.jpg",
    lostDate: "2024년 4월 20일",
    foundDate: "2024년 4월 25일",
    location: "서울시 마포구",
    story: "구름이가 공원에서 사라졌을 때 너무 무서웠어요. COG 덕분에 5일 만에 찾았습니다. 정말 고마워요!",
    owner: "강지은",
  },
]

export function SuccessStories({ onBack }: SuccessStoriesProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button onClick={onBack} variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            돌아가기
          </Button>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-4">성공사례</h1>
            <p className="text-lg text-muted-foreground">COG를 통해 소중한 가족을 다시 만난 이야기들입니다</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {successStories.map((story) => (
            <Card key={story.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-64 w-full">
                <Image src={story.image || "/placeholder.svg"} alt={story.petName} fill className="object-cover" />
                <div className="absolute top-4 right-4 bg-success/90 text-success-foreground px-3 py-1 rounded-full text-sm font-semibold">
                  재회 성공
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-bold text-foreground">{story.petName}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {story.breed} · {story.petType}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>실종: {story.lostDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-success">
                    <Calendar className="w-4 h-4" />
                    <span>발견: {story.foundDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{story.location}</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{story.story}</p>

                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">- {story.owner}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
