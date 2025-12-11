"use client"

import Image from "next/image"

interface HeaderProps {
  onShelterClick?: () => void
  onHelpClick?: () => void
  onLogoClick?: () => void
  onReportClick?: () => void
  onAdoptClick?: () => void
}

export function Header({
  onShelterClick,
  onHelpClick,
  onLogoClick,
  onReportClick,
  onAdoptClick,
}: HeaderProps) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <button onClick={onLogoClick} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image src="/icon.svg" alt="CoG 홈 아이콘" width={32} height={32} className="rounded-md" />
            <span className="text-xl font-bold text-foreground">CoG</span>
          </button>

          <nav className="hidden md:flex items-center gap-6">
            <button onClick={onReportClick} className="text-muted-foreground hover:text-foreground transition-colors">
              실종신고
            </button>
            <button onClick={onAdoptClick} className="text-muted-foreground hover:text-foreground transition-colors">
              입양하기
            </button>
            <button onClick={onShelterClick} className="text-muted-foreground hover:text-foreground transition-colors">
              보호소 동물
            </button>
            <button onClick={onHelpClick} className="text-muted-foreground hover:text-foreground transition-colors">
              도움말
            </button>
          </nav>

          <div className="flex items-center gap-3">
          </div>
        </div>
      </div>
    </header>
  )
}
