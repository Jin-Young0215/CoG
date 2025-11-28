"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, MapPin, Navigation, ChevronRight } from "lucide-react"

interface ShelterAnimalsProps {
  animalType: "dog" | "cat"
  onBack: () => void
}

interface Shelter {
  id: number
  name: string
  address: string
  distance: number
  animals: Animal[]
}

interface Animal {
  id: number
  image: string
  breed: string
  age: string
  gender: string
  date: string
  description: string
}

// 임시 보호소 데이터
const mockShelters: Record<"dog" | "cat", Shelter[]> = {
  dog: [
    {
      id: 1,
      name: "서울시 강남구 동물보호센터",
      address: "서울시 강남구 테헤란로 123",
      distance: 1.2,
      animals: [
        {
          id: 1,
          image: "/cute-brown-dog-at-shelter.jpg",
          breed: "믹스견",
          age: "2살 추정",
          gender: "수컷",
          date: "2024.01.15",
          description: "온순하고 사람을 좋아하는 성격입니다",
        },
        {
          id: 2,
          image: "/white-fluffy-dog-at-shelter.jpg",
          breed: "말티즈",
          age: "3살 추정",
          gender: "암컷",
          date: "2024.01.18",
          description: "활발하고 건강한 상태입니다",
        },
      ],
    },
    {
      id: 2,
      name: "서울시 송파구 유기동물보호소",
      address: "서울시 송파구 올림픽로 456",
      distance: 2.5,
      animals: [
        {
          id: 3,
          image: "/black-dog-at-shelter.jpg",
          breed: "진돗개",
          age: "5살 추정",
          gender: "수컷",
          date: "2024.01.20",
          description: "차분하고 영리한 성격입니다",
        },
      ],
    },
    {
      id: 3,
      name: "경기도 성남시 동물보호센터",
      address: "경기도 성남시 분당구 판교로 789",
      distance: 5.8,
      animals: [
        {
          id: 4,
          image: "/golden-retriever-at-shelter.jpg",
          breed: "리트리버",
          age: "4살 추정",
          gender: "암컷",
          date: "2024.01.22",
          description: "친화력이 좋고 훈련이 잘 되어있습니다",
        },
      ],
    },
  ],
  cat: [
    {
      id: 1,
      name: "서울시 강남구 동물보호센터",
      address: "서울시 강남구 테헤란로 123",
      distance: 1.2,
      animals: [
        {
          id: 1,
          image: "/orange-tabby-cat-at-shelter.jpg",
          breed: "코리안숏헤어",
          age: "1살 추정",
          gender: "수컷",
          date: "2024.01.16",
          description: "호기심이 많고 활발한 성격입니다",
        },
        {
          id: 2,
          image: "/white-persian-cat-at-shelter.jpg",
          breed: "페르시안",
          age: "2살 추정",
          gender: "암컷",
          date: "2024.01.19",
          description: "조용하고 온순한 성격입니다",
        },
      ],
    },
    {
      id: 2,
      name: "서울시 서초구 유기동물보호소",
      address: "서울시 서초구 강남대로 234",
      distance: 3.1,
      animals: [
        {
          id: 3,
          image: "/black-and-white-cat-at-shelter.jpg",
          breed: "턱시도 고양이",
          age: "3살 추정",
          gender: "수컷",
          date: "2024.01.21",
          description: "사람을 잘 따르고 애교가 많습니다",
        },
      ],
    },
    {
      id: 3,
      name: "경기도 고양시 동물보호센터",
      address: "경기도 고양시 일산동구 중앙로 567",
      distance: 7.2,
      animals: [
        {
          id: 4,
          image: "/gray-russian-blue-cat-at-shelter.jpg",
          breed: "러시안블루",
          age: "2살 추정",
          gender: "암컷",
          date: "2024.01.23",
          description: "차분하고 독립적인 성격입니다",
        },
      ],
    },
  ],
}

export function ShelterAnimals({ animalType, onBack }: ShelterAnimalsProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(true)

  const shelters = mockShelters[animalType]
  const title = animalType === "dog" ? "주변 보호소 (강아지)" : "주변 보호소 (고양이)"

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          setIsLoadingLocation(false)
        },
        (error) => {
          setLocationError("위치 정보를 가져올 수 없습니다. 기본 위치로 표시합니다.")
          setIsLoadingLocation(false)
        },
      )
    } else {
      setLocationError("브라우저가 위치 정보를 지원하지 않습니다.")
      setIsLoadingLocation(false)
    }
  }, [])

  if (selectedShelter) {
    return (
      <main className="min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => setSelectedShelter(null)} className="mb-8">
            <ArrowLeft className="w-5 h-5 mr-2" />
            보호소 목록으로
          </Button>

          <div className="mb-12">
            <h1 className="text-3xl md:text-5xl font-bold text-balance mb-4">{selectedShelter.name}</h1>
            <div className="flex items-start gap-2 text-muted-foreground mb-2">
              <MapPin className="w-5 h-5 mt-1 flex-shrink-0" />
              <span className="text-lg">{selectedShelter.address}</span>
            </div>
            <p className="text-lg text-muted-foreground">
              현재 {selectedShelter.animals.length}마리의 {animalType === "dog" ? "강아지" : "고양이"}가 있습니다
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {selectedShelter.animals.map((animal) => (
              <Card key={animal.id} className="overflow-hidden group cursor-pointer hover:shadow-xl transition-shadow">
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={animal.image || "/placeholder.svg"}
                    alt={animal.breed}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2">{animal.breed}</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      {animal.age} · {animal.gender}
                    </p>
                    <p>보호 시작: {animal.date}</p>
                    <p className="text-foreground pt-2">{animal.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={onBack} className="mb-8">
          <ArrowLeft className="w-5 h-5 mr-2" />
          뒤로가기
        </Button>

        <div className="mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-balance mb-4">{title}</h1>
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Navigation className="w-5 h-5" />
            <span className="text-lg">
              {isLoadingLocation
                ? "위치 정보를 가져오는 중..."
                : locationError
                  ? locationError
                  : "현재 위치 기준으로 가까운 순서입니다"}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {shelters.map((shelter) => (
            <Card
              key={shelter.id}
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedShelter(shelter)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-2">{shelter.name}</h3>
                  <div className="flex items-start gap-2 text-muted-foreground mb-3">
                    <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                    <span>{shelter.address}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-primary font-semibold">{shelter.distance}km</span>
                    <span className="text-muted-foreground">
                      보호 중인 {animalType === "dog" ? "강아지" : "고양이"}: {shelter.animals.length}마리
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
