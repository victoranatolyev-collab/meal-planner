import styles from './App.module.scss';

// Skeleton-страница. Реальный UI появится по фазам: /plan, /recipes, /cart, /diary, /rules, /schedule.

export default function App() {
  return (
    <main className={styles.shell}>
      <h1 className={styles.title}>Meal Planner</h1>
      <p className={styles.subtitle}>Frontend skeleton — Phase 0</p>
    </main>
  );
}
