/**
 * Yellow title band used at the top of every inner page.
 */
export default function PageHeader({ title, description, label = 'Explore', badge = '2026', badgeLabel = 'Sports Meet', children, headingTag: Heading = 'h1' }) {
  return (
    <header className="page-header">
      <div className="page-header__pattern" aria-hidden="true" />
      <div className="page-header__content">
        <div className="page-header__top">
          <p className="page-header__eyebrow">9th All India Inter-IIIT Sports Meet · 2026</p>
          <div className="page-header__badge" aria-hidden="true">
            <span>{label}</span>
            <strong>{badge}</strong>
            <span>{badgeLabel}</span>
          </div>
        </div>
        <Heading className="page-header__title">{title}</Heading>
        <div className="page-header__rule" aria-hidden="true" />
        {description && <p className="page-header__description">{description}</p>}
        {children && <div className="page-header__actions">{children}</div>}
      </div>
    </header>
  );
}
