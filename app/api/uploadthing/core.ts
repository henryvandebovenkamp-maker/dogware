import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

/**
 * UploadThing FileRouter.
 * Publieke uploads vanuit de demo-intake: logo, huisstijl, inspiratiebeelden.
 * Bewust beperkt: max 4 afbeeldingen van 4MB.
 */
export const uploadRouter = {
  intakeUploader: f({
    image: { maxFileSize: "4MB", maxFileCount: 4 },
  }).onUploadComplete(async ({ file }) => {
    // Geen gebruikers/auth — bestanden worden alleen via de intake-mail en
    // het adminportaal ontsloten.
    console.info(
      JSON.stringify({
        evt: "upload.complete",
        at: new Date().toISOString(),
        name: file.name,
        size: file.size,
      }),
    );
    return { url: file.ufsUrl };
  }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
