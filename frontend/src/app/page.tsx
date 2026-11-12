import { HeroSection } from "@/components/hero/hero-section"
import { ClimateRail } from "@/components/home/climate-rail"
import { HomeSearchDock } from "@/components/home/home-search-dock"
import { HostCta } from "@/components/home/host-cta"
import { HostStory } from "@/components/home/host-story"
import { SeasonGuide } from "@/components/home/season-guide"
import { StaySlider } from "@/components/home/stay-slider"
import { TrustBand } from "@/components/home/trust-band"

export default function Home() {
  return (
    <div id="top" className="relative bg-paper text-ink">
      <HeroSection headerOffset />

      <div className="relative">
        {/* The dock floats over the seam and stays reachable while browsing
            climates, then scrolls away with the results. */}
        <div className="sticky top-[4.5rem] z-30 -mt-2 px-4 sm:px-6 md:-mt-5 md:top-[5.5rem] lg:px-8">
          <div className="mx-auto max-w-5xl">
            <HomeSearchDock />
          </div>
        </div>

        <ClimateRail />
        <div id="results">
          <StaySlider />
        </div>
      </div>

      <TrustBand />
      <HostStory />
      <SeasonGuide />
      <HostCta />
    </div>
  )
}
