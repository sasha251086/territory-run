import type { ReactNode } from 'react';

export default function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="empty-state__icon" aria-hidden="true">
        {icon}
      </p>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__text muted">{text}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
