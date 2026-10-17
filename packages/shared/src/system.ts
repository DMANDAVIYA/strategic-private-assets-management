import { z } from "zod";

export const AccessInfoSchema = z.object({
  port: z.number().int(),
  lanUrls: z.array(z.string()),
  tailscale: z.object({
    installed: z.boolean(),
    running: z.boolean(),
    hostname: z.string().nullable(),
    httpsUrl: z.string().nullable(),
    serveActive: z.boolean(),
  }),
});
export type AccessInfo = z.infer<typeof AccessInfoSchema>;
