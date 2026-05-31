import { NextResponse } from 'next/server';
import { listTags } from 'core';

/**
 * GET /api/tags
 * Все известные теги (tag_dictionary + ingredients.tags + recipe_tags) для UI-автокомплита
 * в правилах на тегах. Ответ: 200 { tags: string[] }.
 */
export async function GET() {
  const tags = await listTags();
  return NextResponse.json({ tags });
}
