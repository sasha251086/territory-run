export default function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="skeleton-list" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="skeleton-list__item">
          <div className="skel skel--icon" />
          <div className="skeleton-list__body">
            <div className="skel skel--title" />
            <div className="skel skel--text" />
          </div>
        </li>
      ))}
    </ul>
  );
}
