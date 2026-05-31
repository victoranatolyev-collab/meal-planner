import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { InputNumber } from '@/components/base/input/input-number';
import { Select } from '@/components/base/select/select';
import {
  createTagRule,
  deleteTagRule,
  listTagRules,
  updateTagRule,
  type RuleKind,
  type TagRuleCreateBody,
} from '@/api/tag-rules';
import { fetchTags } from '@/api/tags';
import {
  RULE_KINDS,
  RULE_KIND_LABELS,
  tagRuleFormSchema,
  type TagRuleFormValues,
} from './tag-rule-schema';

const RULE_KIND_ITEMS = RULE_KINDS.map((k) => ({ id: k, label: RULE_KIND_LABELS[k] }));

const EMPTY: TagRuleFormValues = {
  ruleKind: 'BAN_TAG',
  tagName: '',
  mealTag: '',
  quantity: NaN,
  exceptionTag: '',
  reason: '',
};

export function TagRulesSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const rulesQuery = useQuery({
    queryKey: ['tag-rules', userId],
    queryFn: () => listTagRules(userId),
  });
  // Все известные теги для выпадающих списков (tag_dictionary + ингредиенты + рецепты).
  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: fetchTags });
  const tagItems = (tagsQuery.data?.tags ?? []).map((t) => ({ id: t, label: t }));

  const { control, handleSubmit, watch, reset } = useForm<TagRuleFormValues>({
    resolver: zodResolver(tagRuleFormSchema),
    defaultValues: EMPTY,
  });

  const ruleKind = watch('ruleKind');
  const showQuantity = ruleKind === 'MIN_PER_WEEK' || ruleKind === 'MAX_PER_WEEK';
  const showMealTag = ruleKind === 'BAN_TAG_IN_MEAL' || ruleKind === 'REQUIRE_TAG_IN_MEAL';

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tag-rules', userId] });

  const createMutation = useMutation({
    mutationFn: createTagRule,
    onSuccess: () => {
      invalidate();
      reset(EMPTY);
    },
  });
  const deleteMutation = useMutation({ mutationFn: deleteTagRule, onSuccess: invalidate });
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateTagRule(id, { isActive }),
    onSuccess: invalidate,
  });

  const onSubmit = (v: TagRuleFormValues) => {
    const body: TagRuleCreateBody = { userId, ruleKind: v.ruleKind, tagName: v.tagName.trim() };
    if (showMealTag && v.mealTag) body.mealTag = v.mealTag.trim();
    if (showQuantity && Number.isFinite(v.quantity)) body.quantity = v.quantity;
    if (v.exceptionTag) body.exceptionTag = v.exceptionTag.trim();
    if (v.reason) body.reason = v.reason.trim();
    createMutation.mutate(body);
  };

  const rules = rulesQuery.data?.items ?? [];

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-primary p-6">
      <h2 className="text-lg font-semibold text-primary">Правила на тегах</h2>

      {rulesQuery.isLoading ? (
        <p className="text-sm text-tertiary">Загрузка…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-tertiary">Пока нет правил.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-secondary">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-primary">
                  {RULE_KIND_LABELS[r.ruleKind]} · <code>{r.tagName}</code>
                  {r.mealTag ? ` @ ${r.mealTag}` : ''}
                  {r.quantity != null ? ` ×${r.quantity}` : ''}
                </span>
                {r.reason && <span className="truncate text-xs text-tertiary">{r.reason}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  color={r.isActive ? 'secondary' : 'tertiary'}
                  onClick={() => toggleMutation.mutate({ id: r.id, isActive: !r.isActive })}
                >
                  {r.isActive ? 'Активно' : 'Выключено'}
                </Button>
                <Button
                  size="sm"
                  color="tertiary-destructive"
                  iconLeading={Trash01}
                  aria-label="Удалить правило"
                  onClick={() => deleteMutation.mutate(r.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 border-t border-secondary pt-4"
      >
        <h3 className="text-sm font-semibold text-primary">Добавить правило</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="ruleKind"
            render={({ field, fieldState }) => (
              <Select
                label="Тип правила"
                placeholder="Выберите тип"
                items={RULE_KIND_ITEMS}
                selectedKey={field.value}
                onSelectionChange={(k) => field.onChange(String(k) as RuleKind)}
                isInvalid={Boolean(fieldState.error)}
                hint={fieldState.error?.message}
              >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
              </Select>
            )}
          />
          <Controller
            control={control}
            name="tagName"
            render={({ field, fieldState }) => (
              <Select
                label="Тег"
                placeholder={tagsQuery.isLoading ? 'Загрузка тегов…' : 'Выберите тег'}
                items={tagItems}
                selectedKey={field.value || null}
                onSelectionChange={(k) => field.onChange(k === null ? '' : String(k))}
                isInvalid={Boolean(fieldState.error)}
                hint={fieldState.error?.message}
              >
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
              </Select>
            )}
          />
          {showMealTag && (
            <Controller
              control={control}
              name="mealTag"
              render={({ field, fieldState }) => (
                <Select
                  label="Meal-тег"
                  placeholder={tagsQuery.isLoading ? 'Загрузка тегов…' : 'Выберите meal-тег'}
                  items={tagItems}
                  selectedKey={field.value || null}
                  onSelectionChange={(k) => field.onChange(k === null ? '' : String(k))}
                  isInvalid={Boolean(fieldState.error)}
                  hint={fieldState.error?.message}
                >
                  {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select>
              )}
            />
          )}
          {showQuantity && (
            <Controller
              control={control}
              name="quantity"
              render={({ field, fieldState }) => (
                <InputNumber
                  label="Количество в неделю"
                  minValue={1}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  isInvalid={Boolean(fieldState.error)}
                  hint={fieldState.error?.message}
                />
              )}
            />
          )}
          <Controller
            control={control}
            name="exceptionTag"
            render={({ field }) => (
              <Input
                label="Тег-исключение (опц.)"
                placeholder="c1_exclusion"
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <Input
                label="Причина (опц.)"
                placeholder="§13a"
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="md" color="primary" isLoading={createMutation.isPending}>
            Добавить правило
          </Button>
          {createMutation.isError && (
            <span className="text-sm text-error-primary">Ошибка добавления</span>
          )}
        </div>
      </form>
    </section>
  );
}
