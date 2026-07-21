import { z } from 'zod';
import { SLUG_PATTERN } from './slug';

export const ianaTimezoneSchema = z
  .string()
  .min(1, 'Timezone is required')
  .max(64, 'Timezone must be at most 64 characters');

const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine((u) => u.startsWith('http://') || u.startsWith('https://'), 'Must be http or https');

export const createGymBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(200)
    .regex(SLUG_PATTERN, 'Slug: lowercase letters, numbers, hyphens only'),
  logoUrl: z
    .string()
    .max(2048)
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t && t.length > 0 ? t : undefined;
    })
    .refine(
      (v) => v === undefined || /^https?:\/\/.+/i.test(v),
      'Logo URL must be http or https'
    )
    .refine((v) => v === undefined || v.length <= 2048, 'Max 2048 characters'),
  address: z.string().max(2000).optional(),
  city: z.string().max(200).optional(),
  country: z.string().max(200).optional(),
  timezone: ianaTimezoneSchema,
  ownerAdmin: z.object({
    name: z.string().min(1, 'Owner name is required').max(200),
    email: z.string().email('Valid owner email required'),
    phone: z.string().max(50).optional(),
    password: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(8, 'Password must be at least 8 characters').max(200).optional()
    ),
  }),
  planId: z.coerce.number().int().positive('Plan ID must be a positive integer'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
  isActive: z.boolean(),
});

export type CreateGymFormValues = z.infer<typeof createGymBodySchema>;

export const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const patchGymProfileSchema = z
  .object({
    name: z.string().min(1).max(500).optional(),
    slug: z
      .string()
      .min(1)
      .max(200)
      .regex(SLUG_PATTERN)
      .optional(),
    logoUrl: z.union([z.null(), httpUrl]).optional(),
    address: z.string().max(2000).optional(),
    city: z.string().max(200).optional(),
    country: z.string().max(200).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().email().optional(),
    timezone: ianaTimezoneSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field' });

export const patchSubscriptionSchema = z
  .object({
    planId: z.coerce.number().int().positive().optional(),
    dueDate: ymdSchema.optional(),
    markPaidAt: ymdSchema.optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'Provide at least one field' });
