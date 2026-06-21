# DogWare 🐾

**Meer tijd voor honden. Minder tijd achter een scherm.**

Premium marketingwebsite voor DogWare — het complete bedrijfsplatform voor de
hondenbranche. Eén centrale omgeving voor planning, klant- & hondenbeheer,
betalingen, webshop, facturatie, communicatie en medewerkers.

Gebouwd voor hondenscholen, uitlaatservices, gedragstherapeuten, trimsalons,
hondenopvang & -pensions, osteopaten, fysiotherapeuten, speur- &
detectiescholen, puppycoaches en iedere ondernemer die werkt met honden.

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **Tailwind CSS v4**
- **Motion** (scroll-animaties)
- **lucide-react** (iconen)
- **Plus Jakarta Sans** (next/font)

## Lokaal draaien

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # productie-build
```

## Structuur

```
app/
  layout.tsx        # fonts, metadata, SEO
  page.tsx          # compositie van alle secties
  globals.css       # design tokens (warm premium palet)
components/
  brand.tsx         # logo + pawmark
  ui.tsx            # Container, Button, Eyebrow, SectionHeading
  reveal.tsx        # scroll-reveal animaties
  site-header.tsx   # sticky nav + mobiel menu
  site-footer.tsx
  dashboard-mock.tsx
  sections/         # alle landingssecties
```

---

Werk met honden. Wij regelen de rest.
