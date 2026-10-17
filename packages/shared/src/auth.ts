import { z } from "zod";

const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email());

export const SetupInput = z.object({
  email: Email,
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(1).max(60),
});
export type SetupInput = z.infer<typeof SetupInput>;

export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1),
  trustDevice: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const UserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  displayName: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const AuthStatusSchema = z.object({
  setupRequired: z.boolean(),
  authenticated: z.boolean(),
  user: UserSchema.nullable(),
});
export type AuthStatus = z.infer<typeof AuthStatusSchema>;
