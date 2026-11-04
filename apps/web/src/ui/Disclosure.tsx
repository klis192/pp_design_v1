import { useId, type ReactNode } from "react";

export function Disclosure({
  title,
  children,
  className = "",
}: {
  title: ReactNode;
  children: ReactNode;
  open?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      className={`work-disclosure ${className}`.trim()}
      aria-labelledby={`${id}-title`}
    >
      <div className="disclosure-heading">
        <h3 id={`${id}-title`}>{title}</h3>
      </div>
      <div id={`${id}-body`} className="work-disclosure-body">
        {children}
      </div>
    </section>
  );
}
