function scorePassword(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  return Math.min(4, score);
}

const LABELS = ['Слабый', 'Средний', 'Хороший', 'Отличный'] as const;

export default function PasswordStrength({ password }: { password: string }) {
  const score = scorePassword(password);
  if (!password) return null;

  const label = LABELS[Math.max(0, score - 1)] ?? 'Слабый';

  return (
    <div className="tr-password-strength">
      <div className="tr-password-strength__head">
        <span>Надёжность</span>
        <span className="tr-password-strength__label">{label}</span>
      </div>
      <div className="tr-password-strength__bars" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={`tr-password-strength__bar${
              index < score ? ` tr-password-strength__bar--${Math.min(score, 4)}` : ''
            }`}
          />
        ))}
      </div>
    </div>
  );
}
