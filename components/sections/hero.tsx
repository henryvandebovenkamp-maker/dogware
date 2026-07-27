import { Avatar } from "@/components/photo";
import { HeroView } from "@/components/sections/hero-view";

/**
 * Servercomponent: rendert het avatarfotootje (dat het bestandssysteem
 * raadpleegt) en geeft het als kant-en-klare node door aan de clientkant,
 * die de teksten laat meebewegen met de gekozen branche.
 */
export function Hero({ branche }: { branche?: string }) {
  return (
    <HeroView
      branche={branche}
      avatar={
        <Avatar
          file="henry-avatar.jpg"
          alt="Henry van de Bovenkamp"
          fallback="🐾"
          position="object-[30%_center]"
          className="h-9 w-9"
        />
      }
    />
  );
}
