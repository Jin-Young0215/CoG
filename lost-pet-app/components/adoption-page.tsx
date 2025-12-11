"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Heart, MapPin, PawPrint } from "lucide-react"

interface ShelterAnimal {
  id: string
  image: string
  breed: string
  age: string
  gender: string
  description: string
  location: string
  shelterName: string
  shelterPhone?: string | null
  type: "dog" | "cat" | "unknown"
  noticeDate?: string | null
}

interface AdoptionPageProps {
  onBack: () => void
  onOpenShelter?: (info: { name: string | null; address: string | null; phone: string | null }) => void
}

function normalizeText(input: string) {
  let str = input.toLowerCase().trim()
  const replacements: Array<[RegExp, string]> = [
    [/서울시/g, "서울특별시"],
    [/전라도/g, "전라"],
    [/전라북도/g, "전라"],
    [/전라남도/g, "전라"],
    [/충청도/g, "충청"],
    [/충청북도/g, "충청"],
    [/충청남도/g, "충청"],
    [/경상도/g, "경상"],
    [/경상북도/g, "경상"],
    [/경상남도/g, "경상"],
    [/디아크\s*동물종합병원/g, "디아크동물종합병원"],
  ]
  for (const [pattern, rep] of replacements) {
    str = str.replace(pattern, rep)
  }
  return str.replace(/\s+/g, "")
}

export function AdoptionPage({ onBack, onOpenShelter }: AdoptionPageProps) {
  const [tab, setTab] = useState<"all" | "dog" | "cat">("all")
  const [keyword, setKeyword] = useState("")
  const [animals, setAnimals] = useState<ShelterAnimal[]>([])
  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationResolved, setLocationResolved] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 12

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationResolved(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationResolved(true)
      },
      () => setLocationResolved(true),
    )
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        const apiPageSize = 50
        let currentPage = 1
        let totalShelters = Infinity
        const collected: ShelterAnimal[] = []

        const parseNoticeDate = (raw?: string | null): Date | null => {
          if (!raw) return null
          const t = raw.trim()
          if (!t) return null
          if (/^\d{8}$/.test(t)) {
            const y = t.slice(0, 4)
            const m = t.slice(4, 6)
            const d = t.slice(6, 8)
            return new Date(`${y}-${m}-${d}T00:00:00`)
          }
          const parsed = new Date(t)
          return isNaN(parsed.getTime()) ? null : parsed
        }

        const isOlderThan10Days = (dateStr?: string | null) => {
          const dt = parseNoticeDate(dateStr)
          if (!dt) return false
          const today = new Date()
          const diffMs = today.getTime() - dt.getTime()
          const diffDays = diffMs / (1000 * 60 * 60 * 24)
          return diffDays >= 10
        }

        while (currentPage <= Math.ceil(totalShelters / apiPageSize)) {
          const query = `/api/shelters?animalType=all&page=${currentPage}&pageSize=${apiPageSize}${
            coords ? `&lat=${coords.lat}&lng=${coords.lng}` : ""
          }`
          const res = await fetch(query, {
            headers: { "ngrok-skip-browser-warning": "true" },
            signal: controller.signal,
          })
          if (!res.ok) throw new Error("failed to load adoption list")
          const data = await res.json()
          totalShelters = data?.total || 0

          const mapped: ShelterAnimal[] = (data?.shelters || []).flatMap((s: any) =>
            (s.animals || []).map((a: any) => {
              const code = a.up_kind_cd || a.typeCode || ""
              const type: ShelterAnimal["type"] =
                code === "417000" ? "dog" : code === "422400" ? "cat" : "unknown"
              const noticeDate = a.notice_sdt || a.date || null
              return {
                id: a.desertion_no || a.id,
                image: a.popfile1 || a.popfile2 || a.image || "/placeholder.svg",
                breed: a.kind_nm || a.breed || "품종 정보 없음",
                age: a.age || "나이 정보 없음",
                gender: a.sex_cd || "성별 정보 없음",
                description: a.special_mark || a.description || "상세 정보 없음",
                location: s.care_addr || s.address || "주소 정보 없음",
                shelterName: s.care_nm || s.name || "보호소 정보 없음",
                shelterPhone: s.care_tel || s.phone || null,
                type,
                noticeDate,
              }
            }),
          )
          collected.push(...mapped)

          if (!data?.shelters?.length) break
          currentPage += 1
        }

        // dedupe by id
        const deduped = Array.from(
          collected.reduce((map, item) => map.set(item.id, item), new Map<string, ShelterAnimal>()).values(),
        )
        const filteredByNotice = deduped.filter((item) => isOlderThan10Days(item.noticeDate))
        setAnimals(filteredByNotice)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setAnimals([])
      } finally {
        setLoading(false)
      }
    }
    if (!locationResolved) {
      return
    }
    run()
    return () => controller.abort()
  }, [coords, locationResolved])

  const filtered = useMemo(() => {
    const key = normalizeText(keyword)
    return animals.filter((a) => {
      if (tab !== "all" && a.type !== tab) return false
      if (!key) return true
      return [a.breed, a.location, a.shelterName, a.description, a.gender]
        .map((field) => normalizeText(field || ""))
        .some((field) => field.includes(key))
    })
  }, [animals, tab, keyword])

  useEffect(() => {
    setPage(1)
    scrollToTop()
  }, [tab, keyword])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-10 space-y-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="px-0">
            ← 뒤로가기
          </Button>
        </div>

          <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
            <div className="space-y-4">
              <h1 className="text-3xl md:text-5xl font-bold leading-tight">입양을 기다리는 친구들을 만나보세요</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              입양은 또 하나의 소중한 만남입니다. 가까운 보호소에서 새로운 가족을 맞이해 보세요. 안전하게 입양
              절차를 진행할 수 있습니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-primary text-primary-foreground"><Heart className="w-4 h-4 mr-1" />책임 입양</Badge>
              <Badge variant="outline"><MapPin className="w-4 h-4 mr-1" />가까운 보호소</Badge>
            </div>
          </div>
          <Card className="border-2 border-primary/30 shadow-lg">
            <CardContent className="p-6 space-y-3">
              <h3 className="text-xl font-semibold">입양 프로세스</h3>
              <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
                <li>입양 상담 신청 및 기본 정보 작성</li>
                <li>보호소 방문·성향 확인 후 입양 결정</li>
                <li>중성화/접종 기록 확인, 입양 서류 작성</li>
                <li>입양 후 적응을 위한 2주 적응 기간 케어</li>
              </ol>
              <div className="pt-2 flex gap-3">
                <Button
                  className="flex-1"
                  asChild
                >
                  <a href="https://www.animal.go.kr/front/community/show.do?boardId=contents&seq=53&menuNo=1000000058" target="_blank" rel="noreferrer">
                    입양 절차 안내 보기
                  </a>
                </Button>
                <Button variant="outline" className="flex-1" onClick={onBack}>
                  실종신고로 돌아가기
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">현재 입양 가능</h2>
                <p className="text-muted-foreground">가까운 보호소에서 입양을 기다리는 동물들입니다.</p>
              </div>
              <div className="flex items-center gap-3">
                <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                  <TabsList>
                    <TabsTrigger value="all">전체</TabsTrigger>
                  <TabsTrigger value="dog">강아지</TabsTrigger>
                  <TabsTrigger value="cat">고양이</TabsTrigger>
                </TabsList>
              </Tabs>
              <Input
                placeholder="이름, 품종, 지역 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-52"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading && (
              <div className="col-span-full text-center text-muted-foreground py-10">불러오는 중...</div>
            )}
            {paged.map((a) => (
              <Card key={a.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video overflow-hidden bg-muted">
                  <img src={a.image} alt={a.breed} className="w-full h-full object-cover" />
                </div>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">{a.breed}</h3>
                    <Badge variant="secondary">
                      {a.type === "dog" ? "강아지" : a.type === "cat" ? "고양이" : "기타"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {a.age} · {a.gender}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{a.location}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{a.description}</p>
                  {a.noticeDate && (
                    <p className="text-xs text-muted-foreground">공고 시작: {a.noticeDate}</p>
                  )}
                  <p className="text-xs text-muted-foreground">보호소: {a.shelterName}</p>
                  <div className="pt-2 flex gap-2">
                    <Button
                      className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                      onClick={() =>
                        onOpenShelter?.({
                          name: a.shelterName || null,
                          address: a.location || null,
                          phone: a.shelterPhone || null,
                        })
                      }
                    >
                      보호소 보기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-10 border border-dashed rounded-xl">
                검색 조건에 맞는 입양 대기 동물이 없습니다.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              총 {filtered.length}마리 · {page}/{totalPages} 페이지
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1))
                  scrollToTop()
                }}
              >
                이전
              </Button>
              <Button
                variant="outline"
                size="sm"
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
        </div>
      </div>
    </main>
  )
}
