import { z } from "zod";

const SecuritySchemeSchema = z
  .object({
    type: z.string().optional(),
    scheme: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export const OpenApiDocumentSchema = z
  .object({
    swagger: z.string().optional(),
    openapi: z.string().optional(),
    securityDefinitions: z.record(z.string(), SecuritySchemeSchema).optional(),
    components: z
      .object({
        securitySchemes: z.record(z.string(), SecuritySchemeSchema).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type OpenApiDocument = z.infer<typeof OpenApiDocumentSchema>;
export type SecurityScheme = z.infer<typeof SecuritySchemeSchema>;

export function declaresBearer(document: OpenApiDocument): boolean {
  const schemes: Array<[string, SecurityScheme]> = [
    ...Object.entries(document.securityDefinitions ?? {}),
    ...Object.entries(document.components?.securitySchemes ?? {}),
  ];
  return schemes.some(([name, scheme]) => {
    const schemeName = scheme.scheme?.toLowerCase();
    return name.toLowerCase() === "bearer" || schemeName === "bearer";
  });
}
