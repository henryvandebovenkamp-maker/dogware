"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { voegBedrijfToe, type GroeiState } from "@/app/actions/groei";
import { BRANCHES } from "@/lib/branches";
import { GRONDSLAG_META } from "@/lib/groei/stappen";
import { GROEI_GRONDSLAGEN } from "@/lib/db/schema";

const IDLE: GroeiState = { status: "idle" };

const veld =
  "w-full rounded-xl bg-white px-4 py-2.5 text-[15px] text-ink outline-none ring-1 ring-ink/10 transition focus:ring-2 focus:ring-brand/40 placeholder:text-ink-300";
const label = "block text-[13px] font-bold text-ink";

export function NieuwBedrijfForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: GroeiState, form: FormData) => {
      const res = await voegBedrijfToe(prev, form);
      if (res.status === "ok") router.push("/admin/groei/bedrijven");
      return res;
    },
    IDLE,
  );

  return (
    <form action={action} className="mt-8 space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5">
        <h2 className="text-sm font-extrabold text-ink">Wie is het?</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="bedrijfsnaam">
              Bedrijfsnaam
            </label>
            <input
              id="bedrijfsnaam"
              name="bedrijfsnaam"
              required
              autoFocus
              className={`${veld} mt-1.5`}
              placeholder="Hondenschool De Vrije Loop"
            />
          </div>

          <div>
            <label className={label} htmlFor="branche">
              Branche
            </label>
            <select id="branche" name="branche" className={`${veld} mt-1.5`}>
              <option value="">— nog niet bekend —</option>
              {BRANCHES.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.naam}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="plaats">
              Plaats
            </label>
            <input id="plaats" name="plaats" className={`${veld} mt-1.5`} placeholder="Zwolle" />
          </div>

          <div className="sm:col-span-2">
            <label className={label} htmlFor="website">
              Website
            </label>
            <input
              id="website"
              name="website"
              type="url"
              className={`${veld} mt-1.5`}
              placeholder="https://devrijeloop.nl"
            />
            <p className="mt-1.5 text-[12px] text-ink-300">
              Hier haal ik de analyse uit. Zonder website valt er niets persoonlijks te
              zeggen.
            </p>
          </div>

          <div>
            <label className={label} htmlFor="voornaam">
              Voornaam contactpersoon
            </label>
            <input
              id="voornaam"
              name="voornaam"
              className={`${veld} mt-1.5`}
              placeholder="Sanne"
            />
            <p className="mt-1.5 text-[12px] text-ink-300">Voor de aanhef.</p>
          </div>

          <div>
            <label className={label} htmlFor="email">
              E-mailadres
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={`${veld} mt-1.5`}
              placeholder="info@devrijeloop.nl"
            />
          </div>
        </div>
      </div>

      {/* Zorgvuldigheid — geen bijzaak */}
      <div className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-ink/5">
        <h2 className="text-sm font-extrabold text-ink">Mag je ze benaderen?</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
          Een BV of VOF mag je benaderen met een afmeldmogelijkheid. Een eenmanszaak is
          juridisch een persoon en vraagt om toestemming. Zolang dit niet is vastgesteld
          blokkeert het systeem verzenden.
        </p>

        <div className="mt-4 space-y-2">
          {GROEI_GRONDSLAGEN.map((g) => {
            const meta = GRONDSLAG_META[g];
            return (
              <label
                key={g}
                className="flex cursor-pointer items-start gap-3 rounded-xl bg-cream px-4 py-3 ring-1 ring-ink/5 transition hover:bg-cream-100 has-[:checked]:bg-brand-50 has-[:checked]:ring-brand/25"
              >
                <input
                  type="radio"
                  name="grondslag"
                  value={g}
                  defaultChecked={g === "onbekend"}
                  className="mt-1 h-4 w-4 accent-[#e0562a]"
                />
                <span>
                  <span className="block text-[14px] font-bold text-ink">{meta.label}</span>
                  <span className="block text-[12px] leading-relaxed text-ink-500">
                    {meta.uitleg}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-5">
          <label className={label} htmlFor="herkomst">
            Waar kwam je ze tegen?
          </label>
          <input
            id="herkomst"
            name="herkomst"
            className={`${veld} mt-1.5`}
            placeholder="Bijv. hondenbeurs Utrecht, of via een Facebookgroep"
          />
          <p className="mt-1.5 text-[12px] text-ink-300">
            Onder de AVG moet je kunnen verantwoorden hoe je aan iemands gegevens komt.
          </p>
        </div>
      </div>

      {state.status === "error" && (
        <p className="text-[14px] font-semibold text-brand-600">{state.message}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold leading-[1.2] text-white shadow-[0_1px_2px_rgba(28,21,15,0.08)] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? "Bezig…" : "Toevoegen"}
        </button>
        <Link
          href="/admin/groei/bedrijven"
          className="text-[14px] font-semibold text-ink-300 transition-colors hover:text-ink-500"
        >
          Annuleren
        </Link>
      </div>
    </form>
  );
}
