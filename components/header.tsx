"use client"

import { Button } from "@/components/ui/button"
import { Heart } from 'lucide-react'

interface HeaderProps {
  onShelterClick?: () => void
  onHelpClick?: () => void
  onLogoClick?: () => void
  onReportClick?: () => void
}

export function Header({
  onShelterClick,
  onHelpClick,
  onLogoClick,
  onReportClick,
}: HeaderProps) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <button onClick={onLogoClick} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">COG</span>
          </button>

          <nav className="hidden md:flex items-center gap-6">
            <button onClick={onReportClick} className="text-muted-foreground hover:text-foreground transition-colors">
              실종신고
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
