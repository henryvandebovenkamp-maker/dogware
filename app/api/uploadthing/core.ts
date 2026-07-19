import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getCurrentUser } from "@/lib/auth/session";

const f = createUploadthing();

/**
 * UploadThing FileRouter (v7, leest UPLOADTHING_TOKEN automatisch).
 *
 * - intakeUploader: publieke uploads vanuit de demo-aanvraag (logo, huisstijl,
 *   inspiratiebeelden). Bewust beperkt tot 4 afbeeldingen van 4MB.
 * - avatarUploader: profielfoto van een ingelogde partner. Alleen toegankelijk
 *   voor een geldige partnersessie.
 */
export const uploadRouter = {
  intakeUploader: f({
    image: { maxFileSize: "4MB", maxFileCount: 4 },
  }).onUploadComplete(async ({ file }) => {
    console.info(
      JSON.stringify({ evt: "upload.intake", at: new Date().toISOString(), size: file.size }),
    );
    return { url: file.ufsUrl };
  }),

  avatarUploader: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const user = await getCurrentUser();
      if (!user || user.role !== "AFFILIATE_PARTNER") {
        throw new UploadThingError("Geen toegang");
      }
      return { userId: user.id };
    })
    .onUploadComplete(async ({ file, metadata }) => {
      console.info(
        JSON.stringify({
          evt: "upload.avatar",
          at: new Date().toISOString(),
          userId: metadata.userId,
        }),
      );
      return { url: file.ufsUrl };
    }),

  // Alleen de Super Admin: een eigen e-maillogo. PNG met transparante
  // achtergrond, retina (breed genoeg voor scherpe weergave).
  emailLogoUploader: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const user = await getCurrentUser();
      if (!user || user.role !== "SUPER_ADMIN") {
        throw new UploadThingError("Geen toegang");
      }
      return { userId: user.id };
    })
    .onUploadComplete(async ({ file, metadata }) => {
      console.info(
        JSON.stringify({
          evt: "upload.email_logo",
          at: new Date().toISOString(),
          userId: metadata.userId,
        }),
      );
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
