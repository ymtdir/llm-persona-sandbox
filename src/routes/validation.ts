import { z } from 'zod';

/**
 * スレッド作成のバリデーションスキーマ
 */
export const createThreadSchema = z.object({
  title: z
    .string()
    .min(1, 'タイトルは1文字以上入力してください')
    .max(100, 'タイトルは100文字以内で入力してください'),
  name: z.string().max(64, '名前は64文字以内で入力してください').optional(),
  email: z.string().email('正しいメールアドレスを入力してください').max(64).optional().or(z.literal('')),
  content: z
    .string()
    .min(1, '内容は1文字以上入力してください')
    .max(2000, '内容は2000文字以内で入力してください'),
});

/**
 * レス投稿のバリデーションスキーマ
 */
export const createPostSchema = z.object({
  name: z.string().max(64, '名前は64文字以内で入力してください').optional(),
  email: z.string().email('正しいメールアドレスを入力してください').max(64).optional().or(z.literal('')),
  content: z
    .string()
    .min(1, '内容は1文字以上入力してください')
    .max(2000, '内容は2000文字以内で入力してください'),
});

/**
 * Zodスキーマ型定義
 */
export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
