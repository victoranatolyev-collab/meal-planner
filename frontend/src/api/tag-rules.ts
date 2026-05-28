import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export type RuleKind =
  | 'BAN_TAG'
  | 'BAN_TAG_IN_MEAL'
  | 'REQUIRE_TAG_IN_MEAL'
  | 'MIN_PER_WEEK'
  | 'MAX_PER_WEEK';

export interface TagRuleDto {
  id: string;
  userId: string;
  ruleKind: RuleKind;
  tagName: string;
  mealTag: string | null;
  quantity: number | null;
  exceptionTag: string | null;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TagRuleCreateBody {
  userId: string;
  ruleKind: RuleKind;
  tagName: string;
  mealTag?: string;
  quantity?: number;
  exceptionTag?: string;
  reason?: string;
}

export interface TagRuleUpdateBody {
  ruleKind?: RuleKind;
  tagName?: string;
  mealTag?: string | null;
  quantity?: number | null;
  exceptionTag?: string | null;
  reason?: string | null;
  isActive?: boolean;
}

export const listTagRules = (userId: string) =>
  apiGet<{ items: TagRuleDto[]; total: number }>(`/tag-rules?userId=${encodeURIComponent(userId)}`);

export const createTagRule = (body: TagRuleCreateBody) =>
  apiPost<TagRuleDto>('/tag-rules', body);

export const updateTagRule = (id: string, body: TagRuleUpdateBody) =>
  apiPatch<TagRuleDto>(`/tag-rules/${id}`, body);

export const deleteTagRule = (id: string) => apiDelete(`/tag-rules/${id}`);
