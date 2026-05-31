import { apiGet } from './client';

/** Все известные теги (tag_dictionary + ingredients + recipe_tags) для выпадающих списков. */
export const fetchTags = () => apiGet<{ tags: string[] }>('/tags');
