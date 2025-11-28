"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { FeatureCards } from "@/components/feature-cards"
import { HowItWorks } from "@/components/how-it-works"
import { SearchSelection } from "@/components/search-selection"
import { ShelterAnimals } from "@/components/shelter-animals"
import { PhotoUpload } from "@/components/photo-upload"
import { SuccessStories } from "@/components/success-stories"
import { HelpPage } from "@/components/help-page"
import { LoginPage } from "@/components/login-page"
import { SignupPage } from "@/components/signup-page"
import { RecommendationsPage } from "@/components/recommendations-page"
import { FlierGenerator } from "@/components/flier-generator"

type PageView =
  | "home"
  | "selection"
  | "upload"
  | "shelter"
  | "success"
  | "help"
  | "login"
  | "signup"
  | "recommendations"
  | "flier"
type AnimalType = "dog" | "cat" | null

export default function HomePage() {
  const [currentView, setCurrentView] = useState<PageView>("home")
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedDetails, setUploadedDetails] = useState<any>(null)

  const handleAnimalSelection = (type: "dog" | "cat") => {
    setSelectedAnimal(type)
    setCurrentView("upload")
  }

  const handlePhotoUploaded = (imageUrl: string, details: any) => {
    setUploadedImage(imageUrl)
    setUploadedDetails(details)
    setCurrentView("recommendations")
  }

  const handleShelterClick = () => {
    setCurrentView("shelter")
  }

  const handleSuccessClick = () => {
    setCurrentView("success")
  }

  const handleHelpClick = () => {
    setCurrentView("help")
  }

  const handleLoginClick = () => {
    setCurrentView("login")
  }

  const handleSignupClick = () => {
    setCurrentView("signup")
  }

  const handleLogoClick = () => {
    setCurrentView("home")
  }

  const handleReportClick = () => {
    setCurrentView("selection")
  }

  const handleFlierClick = () => {
    setCurrentView("flier")
  }

  if (currentView === "recommendations" && selectedAnimal && uploadedImage) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onShelterClick={handleShelterClick}
          onSuccessClick={handleSuccessClick}
          onHelpClick={handleHelpClick}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoClick={handleLogoClick}
          onReportClick={handleReportClick}
          onFlierClick={handleFlierClick}
        />
        <RecommendationsPage
          animalType={selectedAnimal}
          uploadedImage={uploadedImage}
          uploadedDetails={uploadedDetails}
          onBack={() => setCurrentView("upload")}
        />
      </div>
    )
  }

  if (currentView === "login") {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onShelterClick={handleShelterClick}
          onSuccessClick={handleSuccessClick}
          onHelpClick={handleHelpClick}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoClick={handleLogoClick}
          onReportClick={handleReportClick}
          onFlierClick={handleFlierClick}
        />
        <LoginPage onBack={() => setCurrentView("home")} onSignupClick={handleSignupClick} />
      </div>
    )
  }

  if (currentView === "signup") {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onShelterClick={handleShelterClick}
          onSuccessClick={handleSuccessClick}
          onHelpClick={handleHelpClick}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoClick={handleLogoClick}
          onReportClick={handleReportClick}
          onFlierClick={handleFlierClick}
        />
        <SignupPage onBack={() => setCurrentView("home")} onLoginClick={handleLoginClick} />
      </div>
    )
  }

  if (currentView === "help") {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onShelterClick={handleShelterClick}
          onSuccessClick={handleSuccessClick}
          onHelpClick={handleHelpClick}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoClick={handleLogoClick}
          onReportClick={handleReportClick}
          onFlierClick={handleFlierClick}
        />
        <HelpPage onBack={() => setCurrentView("home")} />
      </div>
    )
  }

  if (currentView === "success") {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onShelterClick={handleShelterClick}
          onSuccessClick={handleSuccessClick}
          onHelpClick={handleHelpClick}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoClick={handleLogoClick}
          onReportClick={handleReportClick}
          onFlierClick={handleFlierClick}
        />
        <SuccessStories onBack={() => setCurrentView("home")} />
      </div>
    )
  }

  if (currentView === "upload" && selectedAnimal) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onShelterClick={handleShelterClick}
          onSuccessClick={handleSuccessClick}
          onHelpClick={handleHelpClick}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoClick={handleLogoClick}
          onReportClick={handleReportClick}
          onFlierClick={handleFlierClick}
        />
        <PhotoUpload
          animalType={selectedAnimal}
          onBack={() => setCurrentView("selection")}
          onPhotoUploaded={handlePhotoUploaded}
        />
      </div>
    )
  }

  if (currentView === "shelter") {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onShelterClick={handleShelterClick}
          onSuccessClick={handleSuccessClick}
          onHelpClick={handleHelpClick}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoClick={handleLogoClick}
          onReportClick={handleReportClick}
          onFlierClick={handleFlierClick}
        />
        <ShelterAnimals animalType={selectedAnimal || "dog"} onBack={() => setCurrentView("home")} />
      </div>
    )
  }

  if (currentView === "selection") {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onShelterClick={handleShelterClick}
          onSuccessClick={handleSuccessClick}
          onHelpClick={handleHelpClick}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoClick={handleLogoClick}
          onReportClick={handleReportClick}
          onFlierClick={handleFlierClick}
        />
        <SearchSelection onBack={() => setCurrentView("home")} onSelect={handleAnimalSelection} />
      </div>
    )
  }

  if (currentView === "flier") {
    return (
      <div className="min-h-screen bg-background">
        <Header
          onShelterClick={handleShelterClick}
          onSuccessClick={handleSuccessClick}
          onHelpClick={handleHelpClick}
          onLoginClick={handleLoginClick}
          onSignupClick={handleSignupClick}
          onLogoClick={handleLogoClick}
          onReportClick={handleReportClick}
          onFlierClick={handleFlierClick}
        />
        <FlierGenerator onBack={() => setCurrentView("home")} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        onShelterClick={handleShelterClick}
        onSuccessClick={handleSuccessClick}
        onHelpClick={handleHelpClick}
        onLoginClick={handleLoginClick}
        onSignupClick={handleSignupClick}
        onLogoClick={handleLogoClick}
        onReportClick={handleReportClick}
        onFlierClick={handleFlierClick}
      />
      <main>
        <HeroSection onSearchClick={() => setCurrentView("selection")} />
        <FeatureCards />
        <HowItWorks />
      </main>
    </div>
  )
}
