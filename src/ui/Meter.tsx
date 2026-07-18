// A labeled horizontal meter (0..max) with an optional tone.

interface MeterProps {
  label: string;
  value: number;
  max: number;
  tone?: 'default' | 'warn' | 'danger' | 'good';
  suffix?: string;
  title?: string;
}

export function Meter({ label, value, max, tone = 'default', suffix, title }: MeterProps): JSX.Element {
  const fillPct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter" title={title}>
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <div className="meter-track" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
        <div className={`meter-fill tone-${tone}`} style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  );
}
