"use client";

import { useActionState, useRef, useState } from "react";
import { UploadButton } from "@/lib/uploadthing";
import {
  resetEmailLogo,
  saveEmailLogo,
  type SettingsActionState,
} from "@/app/actions/settings";

const IDLE: SettingsActionState = { status: "idle" };

/**
 * Super Admin: het e-maillogo beheren. Upload → wordt direct opgeslagen; een
 * override kan met één klik worden teruggezet naar het standaardlogo.
 * Raakt uitsluitend e-mails, nooit de website.
 */
export function EmailLogoSettings({
  currentUrl,
  isOverride,
}: {
  currentUrl: string;
  isOverride: boolean;
}) {
  const [saveState, saveAction] = useActionState(saveEmailLogo, IDLE);
  const [resetState, resetAction, resetting] = useActionState(resetEmailLogo, IDLE);

  // Optimistische preview zolang de pagina nog niet is gehervalideerd.
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const previewUrl = uploadedUrl ?? currentUrl;

  const formRef = useRef<HTMLFormElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  const feedback = saveState.status !== "idle" ? saveState : resetState;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ink/5">
      <h2 className="text-sm font-extrabold text-ink">E-maillogo</h2>
      <p className="mt-1 text-[13px] text-ink-500">
        Dit logo staat bovenaan alle DogWare-e-mails. De website blijft
        ongewijzigd.
      </p>

      {/* Preview op cream, exact zoals in de mailheader (234px, hoogte auto). */}
      <div className="mt-4 rounded-xl bg-cream p-6 text-center ring-1 ring-ink/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Huidig e-maillogo"
          style={{ display: "block", width: 234, height: "auto", maxWidth: "100%", margin: "0 auto" }}
        />
      </div>
      <p className="mt-2 text-[11px] font-semibold text-ink-300">
        {uploadedUrl || isOverride ? "Eigen geüpload logo" : "Standaardlogo (DogWare)"}
      </p>

      {/* Verborgen form: de upload-URL wordt hierin gezet en meteen opgeslagen. */}
      <form ref={formRef} action={saveAction} className="hidden">
        <input ref={urlRef} type="hidden" name="url" />
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <UploadButton
          endpoint="emailLogoUploader"
          onUploadBegin={() => setUploading(true)}
          onClientUploadComplete={(files) => {
            setUploading(false);
            const url = files?.[0]?.ufsUrl;
            if (url && urlRef.current && formRef.current) {
              setUploadedUrl(url);
              urlRef.current.value = url;
              formRef.current.requestSubmit();
            }
          }}
          onUploadError={() => setUploading(false)}
          appearance={{
            button:
              "ut-ready:bg-ink ut-uploading:bg-ink/70 rounded-full text-[12px] font-bold px-4 py-2 h-auto after:bg-brand",
            allowedContent: "text-[11px] text-ink-300",
          }}
          content={{
            button: uploading
              ? "Uploaden…"
              : uploadedUrl || isOverride
                ? "Ander logo uploaden"
                : "Eigen logo uploaden",
          }}
        />

        {(isOverride || uploadedUrl) && (
          <form action={resetAction}>
            <button
              type="submit"
              disabled={resetting}
              onClick={() => setUploadedUrl(null)}
              className="rounded-full bg-cream-100 px-4 py-2 text-[12px] font-bold text-ink-700 transition hover:bg-cream-200 disabled:opacity-60"
            >
              {resetting ? "Terugzetten…" : "Terug naar standaard"}
            </button>
          </form>
        )}
      </div>

      {feedback.status !== "idle" && feedback.message && (
        <p
          className={`mt-3 text-[12px] font-semibold ${
            feedback.status === "error" ? "text-brand-600" : "text-sage-600"
          }`}
        >
          {feedback.message}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-300">
        Tip: gebruik een PNG met transparante achtergrond, ongeveer 700&nbsp;px
        breed en zonder slogan — dan blijft het scherp en rustig.
      </p>
    </div>
  );
}
