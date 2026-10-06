import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  QLOO_API_KEY: z.string().min(1, "QLOO_API_KEY is required (the qloo harness reads it from the environment)"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required for the agent"),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
  DATA_DIR: z.string().default("./var"),
  /** Requests per minute per visitor IP for /api routes. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return parsed.data;
}
