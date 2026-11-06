// Hero carousel section — port of buildgrid-shop.html's `.hero`/`.slides`
// section (lines 391-400, 662-694). Server component: slide data comes from
// the catalog API facade; autoplay/navigation lives in the client-only
// HeroCarousel.
import { getHeroSlides } from "@/lib/api/catalog";
import HeroCarousel from "./HeroCarousel";

export default async function Hero() {
  const slides = await getHeroSlides();
  return <HeroCarousel slides={slides} />;
}
