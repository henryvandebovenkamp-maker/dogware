/**
 * Vervangt het `resend`-pakket tijdens tests.
 *
 * Bewust een recorder van de RUWE payload die de SDK zou krijgen. Zo controleert
 * een test wat Resend daadwerkelijk ontvangt (`replyTo`, `from`), en niet wat
 * onze eigen code er in een tussenlaag van vindt.
 */
globalThis.__resendPayloads ??= [];

export class Resend {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.emails = {
      send: async (payload) => {
        globalThis.__resendPayloads.push(payload);
        return { data: { id: `stub_${globalThis.__resendPayloads.length}` }, error: null };
      },
    };
  }
}
