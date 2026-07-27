import type { ReactNode } from "react";
import { Avatar } from "@/components/photo";
import { BRANCHES } from "@/lib/branches";
import { TestimonialsView } from "@/components/sections/testimonials-view";

/**
 * Servercomponent: rendert alle avatarfotootjes (die het bestandssysteem
 * raadplegen) en geeft ze als kant-en-klare nodes door. De clientkant kiest
 * welke verhalen er getoond worden, afhankelijk van de gekozen branche.
 *
 * Plaats echte foto's in /public/photos met de bestandsnaam uit `photo`;
 * zolang die ontbreekt wordt de emoji getoond.
 */
export function Testimonials({ branche }: { branche?: string }) {
  const avatars: Record<string, ReactNode> = {};
  for (const b of BRANCHES) {
    avatars[b.slug] = (
      <Avatar
        file={b.testimonial.photo}
        alt={b.testimonial.name}
        fallback={b.testimonial.emoji}
      />
    );
  }

  return <TestimonialsView branche={branche} avatars={avatars} />;
}
