export default function BrandPreloader() {
  return (
    <div
      className="brand-preloader"
      role="status"
      aria-label="Zitectitute. Learning tech skills made easy."
    >
      <div className="brand-preloader__content">
        <span className="brand-preloader__mark" aria-hidden="true">ZT</span>
        <p className="brand-preloader__name" aria-hidden="true">
          <span className="brand-preloader__wordmark">Zitectitute</span>
        </p>
        <p className="brand-preloader__tagline" aria-hidden="true">
          <span>learning tech skills made easy</span>
        </p>
      </div>
    </div>
  );
}
