import { z } from 'zod';

const CapabilityExampleSchema = z.object({
  title: z.string().min(3).max(120),
  input: z.any(),
  output: z.any(),
});

export const CapabilityContractSchema = z.object({
  summary: z.string().min(3).max(200),
  description: z.string().min(10).max(4000),
  dataAccess: z.array(z.string().min(1)).default([]),
  riskLevel: z.enum(['low', 'medium', 'high']),
  averageDurationMs: z.number().int().positive().optional(),
  estimatedCostUsd: z.number().nonnegative().optional(),
  inputSchema: z.any().optional(),
  outputSample: z.any().optional(),
  examples: z.array(CapabilityExampleSchema).default([]),
  limits: z
    .object({
      idempotent: z.boolean().optional(),
      maxRetries: z.number().int().nonnegative().optional(),
      timeoutMs: z.number().int().positive().optional(),
    })
    .optional(),
  safeMode: z
    .object({
      enabled: z.boolean().default(true),
      approvalRole: z.enum(['operator', 'supervisor', 'admin']).optional(),
    })
    .optional(),
  triggerPhrases: z.array(z.string().min(1)).default([]),
});

export const NewCapabilitySchema = z.object({
  name: z.string().min(3).max(120),
  version: z.string().min(1).max(20).optional(),
  status: z.enum(['draft', 'active', 'deprecated']).optional(),
  contract: CapabilityContractSchema,
});

export const UpdateCapabilitySchema = z.object({
  name: z.string().min(3).max(120).optional(),
  version: z.string().min(1).max(20).optional(),
  status: z.enum(['draft', 'active', 'deprecated']).optional(),
  contract: CapabilityContractSchema.optional(),
});

export type NewCapabilityInput = z.infer<typeof NewCapabilitySchema>;
export type UpdateCapabilityInput = z.infer<typeof UpdateCapabilitySchema>;
