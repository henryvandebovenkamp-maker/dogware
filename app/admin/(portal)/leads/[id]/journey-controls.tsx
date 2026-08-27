"use client";

import { useActionState, useState } from "react";
import {
  changeStage,
  previewDemoMail,
  saveDemoLinks,
  sendDemo,
  sendDemoTestMail,
  type DemoMailPreviewState,
  type JourneyActionState,
} from "@/app/actions/journey";
import { JOURNEY_STAGES, type JourneyStage } from "@/lib/db/schema";
import { STAGE_META } from "@/lib/journey-stages";

const IDLE: JourneyActionState = { status: "idle" };

function Feedback({ state }: { state: JourneyActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p className={`mt-2 text-[12px] font-semibold ${state.status === "error" ? "text-brand-600" : "text-sage-600"}`}>
      {state.message}
    </p>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* stil */
        }
      }}
      className="rounded-full bg-cream-100 px-4 py-2 text-[12px] font-bold text-ink-700 transition hover:bg-cream-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? "Gekopieerd" : label}
    </button>
  );
}

const GEEN_PREVIEW: DemoMailPreviewState = { status: "idle" };

/**
 * Het "demo versturen"-scherm: de twee links die de klant krijgt (de demolink
 * naar de demo-website en de inloglink naar het demoportaal), het mailadres
 * waarmee ze inlogt, de mail zelf om te controleren, en één verstuurknop.
 *
 * De preview en de testmail gebruiken exact dezelfde template en dezelfde
 * gegevens als het echte versturen — wat je hier ziet is wat de klant krijgt.
 */
export function DemoPanel({
  leadId,
  website,
  portaal,
  loginEmail,
  klantEmail,
  alSent,
}: {
  leadId: string;
  website: string;
  portaal: string;
  loginEmail: string;
  klantEmail: string;
  alSent: boolean;
}) {
  const [saveState, saveAction, saving] = useActionState(saveDemoLinks, IDLE);
  const [sendState, sendAction, sending] = useActionState(sendDemo, IDLE);
  const [testState, testAction, testing] = useActionState(sendDemoTestMail, IDLE);
  const [preview, previewAction, previewing] = useActionState(
    previewDemoMail,
    GEEN_PREVIEW,
  );

  // Gecontroleerde velden zodat de kopieer-, preview- en verstuurknoppen
  // allemaal met dezelfde, actuele waarden werken.
  const [w, setW] = useState(website);
  const [p, setP] = useState(portaal);
  const [e, setE] = useState(loginEmail || klantEmail);
  const [testTo, setTestTo] = useState("");
  const [breed, setBreed] = useState(false);

  // Beide links zijn verplicht: de mail draagt ze allebei.
  const compleet = w.trim() !== "" && p.trim() !== "" && e.trim() !== "";

  return (
    <div className="space-y-4">
      {compleet && !alSent && (
        <p className="rounded-xl bg-sage-100 px-4 py-2.5 text-[12.5px] font-bold text-sage-600">
          Demo klaar om te versturen — bekijk de mail hieronder en verstuur hem.
        </p>
      )}

      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="leadId" value={leadId} />
        <Field
          label="Demolink — de demo-website"
          name="website"
          value={w}
          onChange={setW}
          placeholder="https://voorbeeld.example.nl"
        />
        <Field
          label="Inloglink — het demoportaal"
          name="portaal"
          value={p}
          onChange={setP}
          placeholder="https://portaal.example.nl"
        />
        <Field
          label="Login e-mailadres"
          name="loginEmail"
          value={e}
          onChange={setE}
          placeholder={klantEmail}
          type="email"
        />

        <div className="flex flex-wrap gap-2">
          <CopyButton value={w} label="Kopieer demolink" />
          <CopyButton value={p} label="Kopieer inloglink" />
          <CopyButton value={e} label="Kopieer login" />
          <OpenLink value={w} label="Open demo" />
          <OpenLink value={p} label="Open portaal" />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60"
        >
          {saving ? "Opslaan…" : "Links opslaan"}
        </button>
        <Feedback state={saveState} />
      </form>

      {/* De mail bekijken vóór verzending */}
      <form action={previewAction} className="border-t border-cream-100 pt-4">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="website" value={w} />
        <input type="hidden" name="portaal" value={p} />
        <input type="hidden" name="loginEmail" value={e} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={previewing}
            className="rounded-full bg-cream-100 px-4 py-2 text-[12px] font-bold text-ink-700 transition hover:bg-cream-200 disabled:opacity-60"
          >
            {previewing ? "Laden…" : preview.status === "ready" ? "Preview verversen" : "Bekijk de mail"}
          </button>
          {preview.status === "ready" && (
            <button
              type="button"
              onClick={() => setBreed((b) => !b)}
              className="rounded-full bg-cream-100 px-4 py-2 text-[12px] font-bold text-ink-700 transition hover:bg-cream-200"
            >
              {breed ? "Mobiel bekijken" : "Desktop bekijken"}
            </button>
          )}
        </div>
        {preview.status === "error" && (
          <p className="mt-2 text-[12px] font-semibold text-brand-600">{preview.message}</p>
        )}
      </form>

      {preview.status === "ready" && (
        <div className="rounded-2xl bg-cream-50 p-4 ring-1 ring-ink/5">
          <dl className="mb-3 space-y-1 text-[12px] text-ink-500">
            <PreviewRegel label="Onderwerp" waarde={preview.subject} />
            <PreviewRegel label="Naar" waarde={preview.ontvanger} />
            <PreviewRegel label="Knop 1 · Bekijk jouw demo" waarde={preview.demoUrl} link />
            <PreviewRegel label="Knop 2 · Demoportaal" waarde={preview.portaalUrl} link />
            <PreviewRegel label="Inloggen met" waarde={preview.loginEmail} />
            <PreviewRegel label="Templateversie" waarde={preview.templateVersie} />
          </dl>
          {preview.ontbreekt && preview.ontbreekt.length > 0 && (
            <p className="mb-3 rounded-lg bg-brand-100 px-3 py-2 text-[12px] font-semibold text-brand-600">
              Nog niet compleet: {preview.ontbreekt.join(" en ")}. Zolang dat zo is,
              gaat de mail niet naar de klant.
            </p>
          )}
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-ink/10">
            <iframe
              title="Preview van de demo-mail"
              srcDoc={preview.html}
              sandbox=""
              className="block h-[560px] border-0 bg-white"
              style={{ width: breed ? "100%" : 390, margin: "0 auto" }}
            />
          </div>
        </div>
      )}

      {/* Testmail — verandert niets aan de aanvraag of de journey */}
      <form action={testAction} className="border-t border-cream-100 pt-4">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="website" value={w} />
        <input type="hidden" name="portaal" value={p} />
        <input type="hidden" name="loginEmail" value={e} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Field
              label="Testmail sturen naar"
              name="testTo"
              value={testTo}
              onChange={setTestTo}
              placeholder="jij@voorbeeld.nl"
              type="email"
            />
          </div>
          <button
            type="submit"
            disabled={testing || testTo.trim() === ""}
            className="rounded-full bg-ink px-4 py-2.5 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? "Versturen…" : "Verstuur testmail"}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-ink-300">
          Zelfde mail, onderwerp met &ldquo;TEST —&rdquo; ervoor. Verandert niets aan de
          aanvraag, de status of de tijdlijn.
        </p>
        <Feedback state={testState} />
      </form>

      {/* Het echte werk */}
      <form action={sendAction} className="border-t border-cream-100 pt-4">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="website" value={w} />
        <input type="hidden" name="portaal" value={p} />
        <input type="hidden" name="loginEmail" value={e} />
        <p className="mb-3 text-[12px] leading-relaxed text-ink-500">
          De klant krijgt één mail met beide links: de demolink naar haar
          demo-website en de inloglink naar het demoportaal. Inloggen gaat
          zonder wachtwoord, met het adres hierboven.
        </p>
        {!compleet && (
          <p className="mb-3 text-[12px] font-semibold text-brand-600">
            Vul eerst allebei de links in — zonder die twee gaat de mail niet weg.
          </p>
        )}
        <button
          type="submit"
          disabled={sending || !compleet}
          className="w-full rounded-full bg-brand px-5 py-3 text-[14px] font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {sending
            ? "Versturen…"
            : alSent
              ? "Demo opnieuw versturen"
              : "Demo versturen (demolink + inloglink)"}
        </button>
        <Feedback state={sendState} />
      </form>
    </div>
  );
}

/** Eén regel in de controlelijst boven de preview. */
function PreviewRegel({
  label,
  waarde,
  link = false,
}: {
  label: string;
  waarde?: string;
  link?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <dt className="font-semibold text-ink-700">{label}:</dt>
      <dd className="min-w-0 break-all">
        {waarde ? (
          link ? (
            <a
              href={waarde}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 underline"
            >
              {waarde}
            </a>
          ) : (
            waarde
          )
        ) : (
          <span className="font-semibold text-brand-600">ontbreekt</span>
        )}
      </dd>
    </div>
  );
}

/** Opent een ingevulde link in een nieuw tabblad; uitgeschakeld als hij leeg is. */
function OpenLink({ value, label }: { value: string; label: string }) {
  const schoon = value.trim();
  if (!schoon) {
    return (
      <span className="cursor-not-allowed rounded-full bg-cream-100 px-4 py-2 text-[12px] font-bold text-ink-700 opacity-40">
        {label}
      </span>
    );
  }
  return (
    <a
      href={/^https?:\/\//i.test(schoon) ? schoon : `https://${schoon}`}
      target="_blank"
      rel="noreferrer"
      className="rounded-full bg-cream-100 px-4 py-2 text-[12px] font-bold text-ink-700 transition hover:bg-cream-200"
    >
      {label}
    </a>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-[12px] font-semibold text-ink-700">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] font-normal text-ink outline-none placeholder:text-ink-300 focus:border-brand"
      />
    </label>
  );
}

/** Stage handmatig aanpassen — compact. */
export function StageControl({ leadId, current }: { leadId: string; current: JourneyStage }) {
  const [state, action, pending] = useActionState(changeStage, IDLE);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <select
        name="stage"
        defaultValue={current}
        className="rounded-lg border border-cream-200 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
      >
        {JOURNEY_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_META[s].label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-cream hover:bg-ink-700 disabled:opacity-60"
      >
        {pending ? "…" : "Stap zetten"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
