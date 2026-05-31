// Лендинг — дашборд со ссылками на все разделы. UI-кит: Untitled UI React (Tailwind v4).

interface NavCardProps {
  href: string;
  title: string;
  desc: string;
}

function NavCard({ href, title, desc }: NavCardProps) {
  return (
    <a
      href={href}
      className="flex flex-col gap-2 rounded-xl border border-secondary bg-primary p-5 shadow-xs transition hover:shadow-md"
    >
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      <p className="text-sm text-tertiary">{desc}</p>
    </a>
  );
}

const SECTIONS: NavCardProps[] = [
  { href: '/plan', title: 'План недели', desc: 'Сгенерировать и просмотреть план по дням, приёмам и рецептам.' },
  { href: '/recipes', title: 'Блюда', desc: 'Пул рецептов, из которых собирается план недели.' },
  { href: '/diary', title: 'Дневник', desc: 'Записать съеденное и видеть КБЖУ по дням.' },
  { href: '/stock', title: 'Остатки', desc: 'Проекция остатков продуктов: запас − съедено + закупки.' },
  { href: '/cart', title: 'Корзина', desc: 'Собрать корзину из плана и оформить заказ по магазинам.' },
  { href: '/rules', title: 'Правила питания', desc: 'Целевые КБЖУ, недельный бюджет и тег-правила.' },
  { href: '/agent', title: 'Чат с агентом', desc: 'Спросить про план, остатки и нормы на естественном языке.' },
];

export default function App() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2 pt-4">
        <h1 className="text-display-sm font-semibold text-primary">Meal Planner</h1>
        <p className="text-md text-tertiary">
          Персональный подбор питания: план недели, дневник, остатки, заказы, правила КБЖУ и
          LLM-агент с доступом ко всем функциям.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <NavCard key={s.href} {...s} />
        ))}
      </div>
    </main>
  );
}
