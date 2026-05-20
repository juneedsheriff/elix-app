import type { LucideIcon } from 'lucide-react';

type MetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon?: LucideIcon;
};

export default function MetricCard({ title, value, subtitle, icon: Icon }: MetricCardProps) {
  return (
    <article className='metric-card'>
      <div className='metric-card-head'>
        {Icon ? (
          <span className='metric-icon' aria-hidden>
            <Icon size={18} strokeWidth={2} />
          </span>
        ) : null}
        <span>{title}</span>
      </div>
      <h3>{value}</h3>
      <p>{subtitle}</p>
    </article>
  );
}
