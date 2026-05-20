import { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function AppButton({
  children,
  variant = 'primary',
}: {
  children: ReactNode;
  variant?: ButtonVariant;
}) {
  return <button className={`btn btn-${variant}`}>{children}</button>;
}

export function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="card">
      <header className="card-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{delta}</small>
    </article>
  );
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function BarChart({
  items,
}: {
  items: { label: string; value: number; highlight?: boolean }[];
}) {
  return (
    <div className="bar-chart">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span>{item.label}</span>
          <div className="bar-track">
            <div
              className={`bar-fill ${item.highlight ? 'bar-fill-highlight' : ''}`}
              style={{ width: `${item.value}%` }}
            />
          </div>
          <strong>{item.value}%</strong>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="pulse-dot" />
      <h4>{title}</h4>
      <p>{detail}</p>
      {action}
    </div>
  );
}
