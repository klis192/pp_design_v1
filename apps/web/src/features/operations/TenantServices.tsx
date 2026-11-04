import { OperationsData, currency, date } from "./shared";
import "../tenants/personal-mobile.css";
export function TenantServices({ data }: { data: OperationsData | null }) {
  if (!data) return null;
  const news = data.news.filter((item) => item.published);
  const services = data.services.filter((item) => item.active);
  return (
    <article className="personal-services">
      <h3>Объявления</h3>
      <div className="personal-news-list">
        {news.map((n) => (
          <article
            className={`notification-card notification-card--${n.tone}`}
            key={n.id}
          >
            <div className="notification-card-top">
              <span className="notification-dot" />
              <h4>{n.name}</h4>
            </div>
            <p className="preserve-lines">{n.content}</p>
            <small>{date(n.createdAt)}</small>
          </article>
        ))}
        {!news.length && (
          <p className="personal-empty">Новых объявлений пока нет</p>
        )}
      </div>
      <h3>Услуги</h3>
      <div className="personal-service-list">
        {services.map((s) => (
          <article key={s.id}>
            <h4>{s.name}</h4>
            <p>{s.description}</p>
            <small>
              {s.paid
                ? `От ${currency(s.basePrice)} · ${currency(s.hourlyRate)} / ч`
                : "Бесплатно"}
            </small>
          </article>
        ))}
      </div>
      {!services.length && (
        <p className="personal-empty">
          Доступные услуги появятся после публикации управляющей компанией
        </p>
      )}
    </article>
  );
}
