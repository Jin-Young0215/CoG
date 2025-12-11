"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, MapPin, Navigation, ChevronRight, Search } from "lucide-react"

interface ShelterAnimalsProps {
  animalType: "dog" | "cat"
  onBack: () => void
  initialShelterName?: string | null
  initialShelterAddress?: string | null
  initialShelterPhone?: string | null
}

interface Shelter {
  id: string
  name: string
  address: string
  phone?: string | null
  owner?: string | null
  distanceKm: number | null
  lat?: number | null
  lng?: number | null
  animals: Animal[]
}

interface Animal {
  id: string
  image: string | null
  breed: string | null
  typeCode?: string | null
  age: string | null
  gender: string | null
  date: string | null
  description: string | null
}

export function ShelterAnimals({
  animalType,
  onBack,
  initialShelterName = null,
  initialShelterAddress = null,
  initialShelterPhone = null,
}: ShelterAnimalsProps) {
  const [locationError, setLocationError] = useState<string | null>(null)
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null)
  const [searchTerm, setSearchTerm] = useState(initialShelterName || "")
  const [shelters, setShelters] = useState<Shelter[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 30
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationResolved, setLocationResolved] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (initialShelterName && initialShelterName !== searchTerm) {
      setSearchTerm(initialShelterName)
      setPage(1)
    }
  }, [initialShelterName, searchTerm])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          setLocationResolved(true)
        },
        () => {
          setLocationError("위치 정보를 가져올 수 없습니다. 기본 순서로 표시합니다.")
          setLocationResolved(true)
        },
      )
    } else {
      setLocationError("브라우저가 위치 정보를 지원하지 않습니다.")
      setLocationResolved(true)
    }
  }, [])

  useEffect(() => {
    if (!locationResolved) return
    const query = `/api/shelters?animalType=all&page=${page}&pageSize=${pageSize}${
      coords ? `&lat=${coords.lat}&lng=${coords.lng}` : ""
    }${searchTerm.trim() ? `&q=${encodeURIComponent(searchTerm.trim())}` : ""}`
    fetch(query, { headers: { "ngrok-skip-browser-warning": "true" } })
      .then((res) => res.json())
      .then((data) => {
        const mapped = (data?.shelters || []).map((s: any) => ({
          id: s.care_reg_no || s.id,
          name: s.care_nm || "보호소 정보 없음",
          address: s.care_addr || s.address || "주소 정보 없음",
          phone: s.care_tel || s.phone || null,
          owner: s.org_nm || s.owner || null,
          distanceKm: s.distance_km ?? null,
          lat: typeof s.lat === "number" ? s.lat : null,
          lng: typeof s.lng === "number" ? s.lng : null,
          animals: (s.animals || []).map((a: any) => ({
            id: a.desertion_no || a.id,
            image: a.popfile1 || a.popfile2 || a.image || null,
            breed: a.kind_nm || a.breed || null,
            typeCode: a.up_kind_cd || a.typeCode || null,
            age: a.age || null,
            gender: a.sex_cd || a.gender || null,
            date: a.notice_sdt || a.date || null,
            description: a.special_mark || a.description || null,
          })),
        }))

        const merged = mapped.reduce((map, shelter) => {
          const key =
            (shelter.name || "").replace(/\s+/g, "").toLowerCase() ||
            (shelter.address || "").replace(/\s+/g, "").toLowerCase() ||
            shelter.id
          const existing = map.get(key)
          if (!existing) {
            map.set(key, shelter)
            return map
          }
          const animals = [...existing.animals]
          for (const a of shelter.animals) {
            if (!animals.some((x) => x.id === a.id)) {
              animals.push(a)
            }
          }
          map.set(key, {
            ...existing,
            name: existing.name || shelter.name,
            address: existing.address || shelter.address,
            phone: existing.phone || shelter.phone,
            owner: existing.owner || shelter.owner,
            distanceKm: existing.distanceKm ?? shelter.distanceKm ?? null,
            lat: existing.lat ?? shelter.lat ?? null,
            lng: existing.lng ?? shelter.lng ?? null,
            animals,
          })
          return map
        }, new Map<string, Shelter>())

        setShelters(Array.from(merged.values()))
        setTotal(data?.total || 0)
      })
      .catch(() => {
        setShelters([])
        setTotal(0)
      })
  }, [animalType, page, coords, searchTerm])

  useEffect(() => {
    if (selectedShelter || !initialShelterName) return
    const targetName = initialShelterName.toLowerCase().trim()
    const targetAddr = (initialShelterAddress || "").toLowerCase().trim()
    const match = shelters.find((s) => {
      const nameMatch = s.name?.toLowerCase().includes(targetName)
      const addrMatch = targetAddr ? s.address?.toLowerCase().includes(targetAddr) : false
      return Boolean(nameMatch || addrMatch)
    })
    if (match) {
      setSelectedShelter(
        initialShelterPhone && !match.phone ? { ...match, phone: initialShelterPhone } : match,
      )
    }
  }, [shelters, selectedShelter, initialShelterName, initialShelterAddress, initialShelterPhone])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const scrollToTop = () => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: "smooth" })
    } else if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleDetailBack = () => {
    if (initialShelterName) {
      onBack()
    } else {
      setSelectedShelter(null)
    }
  }

  if (selectedShelter) {
    const mapUrl =
      selectedShelter.lat != null &&
      selectedShelter.lng != null
        ? (() => {
            const lat = selectedShelter.lat
            const lng = selectedShelter.lng
            const delta = 0.01
            const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`
            return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
          })()
        : null

    return (
      <main className="min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={handleDetailBack} className="mb-8">
            <ArrowLeft className="w-5 h-5 mr-2" />
            뒤로가기
          </Button>

          <div className="mb-12">
            <h1 className="text-3xl md:text-5xl font-bold text-balance mb-4">{selectedShelter.name}</h1>
            <div className="flex items-start gap-2 text-muted-foreground mb-2">
              <MapPin className="w-5 h-5 mt-1 flex-shrink-0" />
              <span className="text-lg">{selectedShelter.address}</span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
              {selectedShelter.phone && (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
                  📞 {selectedShelter.phone}
                </span>
              )}
              {selectedShelter.owner && (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full">
                  🏢 {selectedShelter.owner}
                </span>
              )}
            </div>
            {mapUrl && (
              <div className="mt-4 rounded-lg overflow-hidden border border-border shadow-sm">
                <iframe
                  title="shelter-map"
                  src={mapUrl}
                  className="w-full h-64"
                  loading="lazy"
                />
                <div className="bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${selectedShelter.lat}&mlon=${selectedShelter.lng}#map=16/${selectedShelter.lat}/${selectedShelter.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    지도에서 보기
                  </a>
                </div>
              </div>
            )}
            <p className="text-lg text-muted-foreground">
              현재 {selectedShelter.animals.length}마리의 동물이 있습니다
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {selectedShelter.animals.map((animal) => (
              <Card key={animal.id} className="overflow-hidden group cursor-pointer hover:shadow-xl transition-shadow">
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={animal.image || "/placeholder.svg"}
                    alt={animal.breed || "animal"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2">{animal.breed || "정보 없음"}</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      {animal.age || "나이 정보 없음"} · {animal.gender || "성별 정보 없음"}
                    </p>
                    <p>보호 시작: {animal.date || "정보 없음"}</p>
                    <p className="text-foreground pt-2">{animal.description || "설명 없음"}</p>
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

        <div className="mb-12 space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold text-balance">보호소 목록</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Navigation className="w-5 h-5" />
            <span className="text-lg">
              {coords ? "현재 위치 기준으로 가까운 순서입니다." : locationError || "전국 보호소 목록입니다."}
            </span>
          </div>
          <div className="flex gap-2 items-center max-w-xl">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="보호소 이름이나 주소로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="h-[70vh] pr-2 overflow-y-auto" ref={listRef}>
          <div className="space-y-4">
            {shelters.map((shelter) => (
              <Card
                key={shelter.id}
                className="p-4 md:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedShelter(shelter)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-xl">{shelter.name}</h3>
                    <div className="flex items-start gap-2 text-muted-foreground mt-1">
                      <MapPin className="w-4 h-4 mt-[2px] flex-shrink-0" />
                      <span>{shelter.address}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    {shelter.distanceKm ? `${shelter.distanceKm.toFixed(1)} km` : "거리 정보 없음"}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between gap-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                    {shelter.animals.slice(0, 4).map((animal) => (
                      <div key={animal.id} className="bg-muted rounded-lg p-2">
                        <div className="aspect-[4/3] overflow-hidden rounded-md mb-2">
                          <img
                            src={animal.image || "/placeholder.svg"}
                            alt={animal.breed || "animal"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-sm font-medium truncate">{animal.breed || "정보 없음"}</p>
                        <p className="text-xs text-muted-foreground">{animal.age || ""}</p>
                      </div>
                    ))}
                  </div>
                  <div className="text-right min-w-[120px]">
                    <p className="text-sm text-muted-foreground">
                      보호 중 {animalType === "dog" ? "강아지" : "고양이"}
                    </p>
                    <p className="text-2xl font-bold">{shelter.animals.length}마리</p>
                    <Button variant="outline" className="gap-2 mt-3">
                      상세 보기
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1))
              scrollToTop()
            }}
          >
            이전
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1))
              scrollToTop()
            }}
          >
            다음
          </Button>
        </div>
      </div>
    </main>
  )
}
