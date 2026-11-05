import { useEffect, useState, type CSSProperties } from "react";

/**
 * Декоративная панель экрана входа: светлая карточка с мягким
 * «дышащим» пятном цвета линии. Пятно — залитый блок, обрезанный
 * многоугольником из случайных точек; точки меняются раз в несколько
 * секунд, CSS плавно переводит форму, сильное размытие скругляет углы.
 * При prefers-reduced-motion и в фоновой вкладке форма не меняется.
 */
const POINTS = 16;
const STEP_MS = 3200;

const randomPolygon = () =>
  `polygon(${Array.from(
    { length: POINTS },
    () =>
      `${(Math.random() * 120 - 10).toFixed(2)}% ${(Math.random() * 120 - 10).toFixed(2)}%`,
  ).join(", ")})`;

export function LoginSitePlan() {
  const [shape, setShape] = useState(randomPolygon);

  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (still?.matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setShape(randomPolygon());
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="login-visual" aria-hidden="true">
      <div className="login-visual__glow">
        <div
          className="login-visual__shape"
          style={{ clipPath: shape } as CSSProperties}
        />
      </div>
      <div className="login-visual__text">
        <strong>склад контур</strong>
        <span>Аренда и эксплуатация складской недвижимости</span>
      </div>
    </div>
  );
}
