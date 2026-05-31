import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/use-current-user';
import { Button } from '@/components/base/buttons/button';
import { searchIngredients, type IngredientDto } from '@/api/ingredients';
import {
  fetchRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  type RecipeListItemDto,
  type RecipeInput,
} from '@/api/recipes';

// Страница /recipes — пул блюд планировщика + CRUD. КБЖУ авто из состава; ингредиент из справочника (поиск).

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round = (v: string | number | null): number => Math.round(num(v));

const inputCx =
  'w-full rounded-md border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-tertiary';

/** Строка состава в форме: id + граммы + закэшированные КБЖУ/100г (для предпросмотра) + имя. */
interface IngRow {
  ingredientId: string;
  name: string;
  qtyG: number;
  kcal100g: number;
  protein100g: number;
  fat100g: number;
  carbs100g: number;
}

interface FormState {
  name: string;
  instructions: string;
  tags: string[];
  ingredients: IngRow[];
  isApproved: boolean;
  isNormalized: boolean;
}

function toForm(r: RecipeListItemDto): FormState {
  return {
    name: r.name,
    instructions: r.instructions,
    tags: r.tags.map((t) => t.tagName),
    ingredients: r.ingredients.map((i) => ({
      ingredientId: i.ingredient.id,
      name: i.ingredient.name,
      qtyG: i.qtyG,
      kcal100g: num(i.ingredient.kcal100g),
      protein100g: num(i.ingredient.protein100g),
      fat100g: num(i.ingredient.fat100g),
      carbs100g: num(i.ingredient.carbs100g),
    })),
    isApproved: r.isApproved,
    isNormalized: r.isNormalized,
  };
}

const emptyForm: FormState = {
  name: '',
  instructions: '',
  tags: [],
  ingredients: [],
  isApproved: true,
  isNormalized: true,
};

const rowFromDto = (d: IngredientDto): IngRow => ({
  ingredientId: d.id,
  name: d.name,
  qtyG: 100,
  kcal100g: num(d.kcal100g),
  protein100g: num(d.protein100g),
  fat100g: num(d.fat100g),
  carbs100g: num(d.carbs100g),
});

/** Поисковый пикер ингредиента из каталога (по подстроке имени). */
function IngredientPicker({ onPick }: { onPick: (d: IngredientDto) => void }) {
  const [q, setQ] = useState('');
  const results = useQuery({
    queryKey: ['ingredient-search', q],
    queryFn: () => searchIngredients(q),
    enabled: q.trim().length >= 2,
  });
  const items = results.data?.items ?? [];

  return (
    <div className="relative flex-1">
      <input
        className={inputCx}
        placeholder="Поиск ингредиента (от 2 букв)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim().length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-secondary bg-primary shadow-md">
          {items.length === 0 && (
            <li className="px-3 py-2 text-sm text-tertiary">
              {results.isLoading ? 'Поиск…' : 'Ничего не найдено'}
            </li>
          )}
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  onPick(it);
                  setQ('');
                }}
              >
                <span className="text-primary">{it.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-tertiary">
                  {round(it.kcal100g)} ккал/100г
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecipeForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSave: (input: RecipeInput) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));

  const macros = useMemo(
    () =>
      f.ingredients.reduce(
        (acc, r) => {
          const k = r.qtyG / 100;
          return {
            kcal: acc.kcal + r.kcal100g * k,
            protein: acc.protein + r.protein100g * k,
            fat: acc.fat + r.fat100g * k,
            carbs: acc.carbs + r.carbs100g * k,
          };
        },
        { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      ),
    [f.ingredients],
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const patchRow = (idx: number, patch: Partial<IngRow>) =>
    set('ingredients', f.ingredients.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const submit = () => {
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    const ingredients = f.ingredients
      .filter((i) => i.ingredientId && i.qtyG > 0)
      .map((i) => ({ ingredientId: i.ingredientId, qtyG: i.qtyG }));
    onSave({
      name: f.name,
      instructions: f.instructions,
      tags,
      ingredients,
      isApproved: f.isApproved,
      isNormalized: f.isNormalized,
      kcal: Math.round(macros.kcal),
      proteinG: Math.round(macros.protein),
      fatG: Math.round(macros.fat),
      carbsG: Math.round(macros.carbs),
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-brand bg-primary p-5">
      <input
        className={inputCx}
        placeholder="Название блюда"
        value={f.name}
        onChange={(e) => set('name', e.target.value)}
      />

      <div className="flex items-baseline justify-between rounded-md bg-secondary px-3 py-2">
        <span className="text-xs text-tertiary">КБЖУ (авто из состава)</span>
        <span className="text-sm tabular-nums text-primary">
          {Math.round(macros.kcal)} ккал · Б {Math.round(macros.protein)} · Ж{' '}
          {Math.round(macros.fat)} · У {Math.round(macros.carbs)}
        </span>
      </div>

      <input
        className={inputCx}
        placeholder="Теги через запятую (завтрак, белок, iron_meal)"
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs text-tertiary">Состав</span>
        {f.ingredients.map((ing, idx) => (
          <div key={idx} className="flex items-center gap-2 border-t border-secondary pt-2">
            <span className="flex-1 text-sm text-primary">
              {ing.name}{' '}
              <span className="text-xs text-tertiary">({round(ing.kcal100g)} ккал/100г)</span>
            </span>
            <input
              type="number"
              className="w-20 shrink-0 rounded-md border border-secondary bg-primary px-2 py-1.5 text-sm text-primary"
              value={ing.qtyG}
              onChange={(e) => patchRow(idx, { qtyG: Number(e.target.value) })}
            />
            <span className="text-xs text-tertiary">г</span>
            <button
              type="button"
              className="shrink-0 px-1 text-sm text-tertiary hover:text-primary"
              onClick={() => set('ingredients', f.ingredients.filter((_, i) => i !== idx))}
            >
              ✕
            </button>
          </div>
        ))}
        <IngredientPicker onPick={(d) => set('ingredients', [...f.ingredients, rowFromDto(d)])} />
      </div>

      <textarea
        className={inputCx}
        rows={2}
        placeholder="Инструкция приготовления (опц.)"
        value={f.instructions}
        onChange={(e) => set('instructions', e.target.value)}
      />

      <label className="flex items-center gap-2 text-sm text-secondary">
        <input
          type="checkbox"
          checked={f.isApproved}
          onChange={(e) => set('isApproved', e.target.checked)}
        />
        В пуле планировщика (approved)
      </label>

      <div className="flex gap-2">
        <Button color="primary" size="sm" isLoading={saving} isDisabled={!f.name.trim()} onClick={submit}>
          Сохранить
        </Button>
        <Button color="secondary" size="sm" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </section>
  );
}

function RecipeCard({
  recipe,
  onEdit,
  onDelete,
  deleting,
}: {
  recipe: RecipeListItemDto;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-secondary bg-primary p-5">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-md font-semibold text-primary">{recipe.name}</h3>
        <span className="shrink-0 text-xs tabular-nums text-tertiary">
          {round(recipe.totalKcal)} ккал · Б {round(recipe.totalProteinG)} · Ж{' '}
          {round(recipe.totalFatG)} · У {round(recipe.totalCarbsG)}
        </span>
      </header>

      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recipe.tags.map((t) => (
            <span key={t.tagName} className="rounded bg-secondary px-1.5 py-0.5 text-xs text-tertiary">
              {t.tagName}
            </span>
          ))}
        </div>
      )}

      {recipe.ingredients.length > 0 && (
        <ul className="flex flex-col gap-0.5 border-t border-secondary pt-2">
          {recipe.ingredients.map((i, idx) => (
            <li
              key={`${i.ingredient.id}-${idx}`}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="text-secondary">
                {i.ingredient.name}
                {i.freshAddon && <span className="text-tertiary"> · свежий</span>}
              </span>
              <span className="shrink-0 tabular-nums text-tertiary">{i.qtyG} г</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="flex gap-3 border-t border-secondary pt-3">
        <button className="text-sm text-brand-secondary hover:underline" onClick={onEdit}>
          Изменить
        </button>
        <button
          className="text-sm text-error-primary hover:underline disabled:opacity-50"
          onClick={onDelete}
          disabled={deleting}
        >
          Удалить
        </button>
      </footer>
    </section>
  );
}

export default function RecipesPage() {
  const { userId, hasUser, isLoading: userLoading } = useCurrentUser();
  const qc = useQueryClient();
  const recipesQuery = useQuery({
    queryKey: ['recipes', userId],
    queryFn: () => fetchRecipes(userId as string),
    enabled: Boolean(userId),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['recipes', userId] });

  const createMut = useMutation({
    mutationFn: (input: RecipeInput) => createRecipe(userId as string, input),
    onSuccess: () => {
      setEditing(null);
      void invalidate();
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecipeInput }) => updateRecipe(id, input),
    onSuccess: () => {
      setEditing(null);
      void invalidate();
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: () => void invalidate(),
  });

  const items = recipesQuery.data?.items ?? [];
  const saving = createMut.isPending || updateMut.isPending;
  const mutError = createMut.error ?? updateMut.error ?? deleteMut.error;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-display-xs font-semibold text-primary">Блюда</h1>
          <p className="text-sm text-tertiary">
            Пул рецептов, из которых собирается план недели. КБЖУ считается из состава.
          </p>
        </div>
        {hasUser && editing === null && (
          <Button color="primary" size="sm" onClick={() => setEditing('new')}>
            + Добавить блюдо
          </Button>
        )}
      </header>

      {editing === 'new' && (
        <RecipeForm
          initial={emptyForm}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={(input) => createMut.mutate(input)}
        />
      )}

      {mutError && (
        <p className="text-sm text-error-primary">
          Ошибка: {mutError instanceof Error ? mutError.message : 'не удалось'}
        </p>
      )}

      {(userLoading || recipesQuery.isLoading) && <p className="text-sm text-tertiary">Загрузка…</p>}

      {!userLoading && !hasUser && (
        <p className="text-sm text-tertiary">Нет пользователя. Засидите одного в БД.</p>
      )}

      {hasUser && recipesQuery.data && items.length === 0 && editing === null && (
        <p className="text-sm text-tertiary">Пул пуст — добавь первое блюдо.</p>
      )}

      {items.length > 0 && (
        <>
          <p className="text-sm text-tertiary">Всего блюд в пуле: {items.length}</p>
          <div className="flex flex-col gap-4">
            {items.map((r) =>
              editing === r.id ? (
                <RecipeForm
                  key={r.id}
                  initial={toForm(r)}
                  saving={saving}
                  onCancel={() => setEditing(null)}
                  onSave={(input) => updateMut.mutate({ id: r.id, input })}
                />
              ) : (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  deleting={deleteMut.isPending}
                  onEdit={() => setEditing(r.id)}
                  onDelete={() => {
                    if (confirm(`Удалить «${r.name}»?`)) deleteMut.mutate(r.id);
                  }}
                />
              ),
            )}
          </div>
          <p className="text-xs text-tertiary">* — свежий добавляемый ингредиент (не из батча).</p>
        </>
      )}
    </main>
  );
}
