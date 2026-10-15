// Gráficos do Scrum em SVG: burndown (linhas) e velocidade (barras agrupadas).
// Cores por variáveis CSS (--chart-1, --chart-2, --chart-ref), validadas para os temas claro e escuro.
// Cada gráfico tem legenda, tooltip no hover/foco e os dados também em tabela.
import { useId, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.jsx';

const W = 640;
const H = 240;
const PAD = { l: 40, r: 16, t: 14, b: 30 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

// Marcas do eixo y: até 4 divisões "redondas"
function ticks(max) {
  const step = Math.max(1, Math.ceil(max / 4 / 5) * 5 || 1);
  const out = [];
  for (let v = 0; v <= max + step / 2 && out.length < 6; v += step) out.push(v);
  return out;
}

function Legend({ items }) {
  return (
    <ul className="kt-chart-legend list-unstyled d-flex flex-wrap gap-3 mb-2">
      {items.map(({ label, className }) => (
        <li key={label}><span className={`kt-swatch ${className}`} aria-hidden="true" />{label}</li>
      ))}
    </ul>
  );
}

function DataTable({ caption, head, rows }) {
  const { t } = useI18n();
  return (
    <details className="mt-2 small">
      <summary>{t('scrum.tableView')}</summary>
      <table className="table table-sm mt-2 mb-0">
        <caption className="visually-hidden">{caption}</caption>
        <thead><tr>{head.map((h) => <th scope="col" key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c ?? '—'}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

const shortDay = (day) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function BurndownChart({ burndown, title }) {
  const { t } = useI18n();
  const id = useId();
  const [hover, setHover] = useState(null);
  const { points, total } = burndown;
  const max = Math.max(total, 1);
  const yTicks = ticks(max);
  const top = yTicks[yTicks.length - 1] || max;
  const x = (i) => PAD.l + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v) => PAD.t + plotH - (plotH * v) / top;
  const ideal = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.ideal)}`).join(' ');
  const real = points.filter((p) => p.remaining != null);
  const realPath = real.map((p, i) => `${i ? 'L' : 'M'}${x(points.indexOf(p))},${y(p.remaining)}`).join(' ');
  const labelEvery = Math.ceil(points.length / 7);
  const h = hover == null ? null : points[hover];

  return (
    <figure className="kt-chart mb-0" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="fw-semibold mb-1">{title}</figcaption>
      <Legend items={[{ label: t('scrum.remaining'), className: 'is-1' }, { label: t('scrum.ideal'), className: 'is-ref' }]} />
      <div className="kt-chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          {yTicks.map((v) => (
            <g key={v}>
              <line className="kt-chart-grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
              <text className="kt-chart-axis" x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (
            <text key={p.day} className="kt-chart-axis" x={x(i)} y={H - 8} textAnchor="middle">{shortDay(p.day)}</text>
          ))}
          <path className="kt-chart-line is-ref" d={ideal} />
          {real.length > 0 && <path className="kt-chart-line is-1" d={realPath} />}
          {real.map((p) => <circle key={p.day} className="kt-chart-dot is-1" cx={x(points.indexOf(p))} cy={y(p.remaining)} r={4} />)}
          {h && <line className="kt-chart-cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + plotH} />}
          {/* alvos de hover maiores que as marcas: uma faixa por dia */}
          {points.map((p, i) => (
            <rect key={p.day} className="kt-chart-hit" x={x(i) - plotW / points.length / 2} y={PAD.t} width={plotW / points.length} height={plotH}
              tabIndex={0} aria-label={`${shortDay(p.day)}: ${t('scrum.remaining')} ${p.remaining ?? '—'}, ${t('scrum.ideal')} ${p.ideal}`}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
          ))}
        </svg>
        {h && (
          <div className="kt-chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <strong>{shortDay(h.day)}</strong>
            <span><span className="kt-swatch is-1" aria-hidden="true" />{t('scrum.remaining')}: {h.remaining ?? '—'}</span>
            <span><span className="kt-swatch is-ref" aria-hidden="true" />{t('scrum.ideal')}: {h.ideal}</span>
          </div>
        )}
      </div>
      <DataTable caption={title} head={[t('scrum.day'), t('scrum.remaining'), t('scrum.ideal')]}
        rows={points.map((p) => [shortDay(p.day), p.remaining, p.ideal])} />
    </figure>
  );
}

export function VelocityChart({ velocity, title }) {
  const { t } = useI18n();
  const id = useId();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...velocity.flatMap((v) => [v.committed, v.done]));
  const yTicks = ticks(max);
  const top = yTicks[yTicks.length - 1] || max;
  const group = plotW / velocity.length;
  const barW = Math.min(28, (group - 16) / 2);
  const y = (v) => PAD.t + plotH - (plotH * v) / top;
  // barra com o topo arredondado (4px) e a base reta, apoiada no eixo
  const bar = (x0, v) => {
    const h = Math.max(0, plotH * (v / top));
    const r = Math.min(4, h, barW / 2);
    const yb = PAD.t + plotH;
    return `M${x0},${yb} V${yb - h + r} Q${x0},${yb - h} ${x0 + r},${yb - h} H${x0 + barW - r} Q${x0 + barW},${yb - h} ${x0 + barW},${yb - h + r} V${yb} Z`;
  };
  const series = [['committed', 'is-1'], ['done', 'is-2']];
  const h = hover == null ? null : velocity[hover];

  return (
    <figure className="kt-chart mb-0" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="fw-semibold mb-1">{title}</figcaption>
      <Legend items={series.map(([key, className]) => ({ label: t(`scrum.${key}`), className }))} />
      <div className="kt-chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          {yTicks.map((v) => (
            <g key={v}>
              <line className="kt-chart-grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
              <text className="kt-chart-axis" x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          {velocity.map((s, i) => {
            const cx = PAD.l + group * i + group / 2;
            return (
              <g key={s.number}>
                {series.map(([key, className], j) => (
                  <path key={key} className={`kt-chart-bar ${className}`} d={bar(cx - barW - 1 + j * (barW + 2), s[key])} />
                ))}
                {/* rótulo direto só no concluído (o número que importa) */}
                <text className="kt-chart-value" x={cx + 1 + barW / 2} y={y(s.done) - 6} textAnchor="middle">{s.done}</text>
                <text className="kt-chart-axis" x={cx} y={H - 8} textAnchor="middle">S{s.number}</text>
                <rect className="kt-chart-hit" x={cx - group / 2} y={PAD.t} width={group} height={plotH} tabIndex={0}
                  aria-label={`Sprint ${s.number}: ${t('scrum.committed')} ${s.committed}, ${t('scrum.done')} ${s.done}`}
                  onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
              </g>
            );
          })}
        </svg>
        {h && (
          <div className="kt-chart-tip" style={{ left: `${((PAD.l + group * hover + group / 2) / W) * 100}%` }} role="status">
            <strong>Sprint {h.number}{h.name ? ` · ${h.name}` : ''}</strong>
            <span><span className="kt-swatch is-1" aria-hidden="true" />{t('scrum.committed')}: {h.committed}</span>
            <span><span className="kt-swatch is-2" aria-hidden="true" />{t('scrum.done')}: {h.done}</span>
          </div>
        )}
      </div>
      <DataTable caption={title} head={[t('scrum.sprint'), t('scrum.committed'), t('scrum.done')]}
        rows={velocity.map((s) => [`${s.number}${s.name ? ` · ${s.name}` : ''}`, s.committed, s.done])} />
    </figure>
  );
}
