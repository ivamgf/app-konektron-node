// Diagrama de casos de uso (UML) desenhado a partir dos casos de uso cadastrados.
// Notação conforme Guedes (UML 2, cap. 3): atores como bonecos, casos de uso como elipses dentro
// da fronteira do sistema, «include»/«extend» tracejados com seta e generalização com triângulo vazado.
import { useId } from 'react';

const W = 900;
const CX = W / 2;
const RX = 125;
const RY = 27;
const ROW = 78;
const TOP = 78;
const ACTOR_GAP = 96;

export const actorLines = (text) =>
  String(text ?? '').split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean);

// Quebra o nome do caso de uso em até 2 linhas para caber na elipse
function wrap(text, max = 26) {
  const words = String(text).split(/\s+/);
  const out = [''];
  for (const w of words) {
    const cur = out[out.length - 1];
    if ((cur + ' ' + w).trim().length > max && cur && out.length < 2) out.push(w);
    else out[out.length - 1] = (cur + ' ' + w).trim();
  }
  if (out.length === 2 && out[1].length > max) out[1] = out[1].slice(0, max - 1) + '…';
  return out;
}

// Distribui atores perto dos casos de uso que usam, sem sobreposição
function placeActors(names, ysOf, minY) {
  const items = names.map((name) => {
    const ys = ysOf(name);
    return { name, y: ys.reduce((a, b) => a + b, 0) / ys.length };
  }).sort((a, b) => a.y - b.y);
  let last = -Infinity;
  for (const it of items) {
    it.y = Math.max(it.y, minY, last + ACTOR_GAP);
    last = it.y;
  }
  return Object.fromEntries(items.map((it) => [it.name, it.y]));
}

function Actor({ x, y, name }) {
  return (
    <g className="kt-uml-actor" transform={`translate(${x},${y - 30})`}>
      <circle cx="0" cy="0" r="9" />
      <line x1="0" y1="9" x2="0" y2="34" />
      <line x1="-15" y1="18" x2="15" y2="18" />
      <line x1="0" y1="34" x2="-12" y2="52" />
      <line x1="0" y1="34" x2="12" y2="52" />
      <text x="0" y="68" textAnchor="middle">{name}</text>
    </g>
  );
}

export function layoutUseCases(useCases, relations) {
  const ordered = [...useCases].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const yOf = Object.fromEntries(ordered.map((u, i) => [u.id, TOP + 40 + i * ROW]));
  const primary = [...new Set(ordered.map((u) => u.primaryActor.trim()))];
  const secondary = [...new Set(ordered.flatMap((u) => actorLines(u.secondaryActors)))].filter((a) => !primary.includes(a));
  const ysFor = (pick) => (name) => ordered.filter((u) => pick(u).includes(name)).map((u) => yOf[u.id]);
  const left = placeActors(primary, ysFor((u) => [u.primaryActor.trim()]), TOP + 40);
  const right = placeActors(secondary, ysFor((u) => actorLines(u.secondaryActors)), TOP + 40);
  const links = [
    ...ordered.filter((u) => u.generalUseCaseId && yOf[u.generalUseCaseId]).map((u) => ({ kind: 'generalization', from: u.id, to: u.generalUseCaseId })),
    ...relations.filter((r) => yOf[r.fromUseCaseId] && yOf[r.toUseCaseId]).map((r) => ({ kind: r.type, from: r.fromUseCaseId, to: r.toUseCaseId })),
  ];
  const bottom = Math.max(TOP + 40 + (ordered.length - 1) * ROW + RY, ...Object.values(left), ...Object.values(right)) + 60;
  return { ordered, yOf, left, right, links, height: Math.max(bottom, 240) };
}

export default function UseCaseDiagram({ title, useCases, relations = [] }) {
  const uid = useId().replace(/:/g, '');
  const { ordered, yOf, left, right, links, height } = layoutUseCases(useCases, relations);
  const arrow = `kt-arrow-${uid}`;
  const triangle = `kt-tri-${uid}`;
  const titleId = `kt-uml-title-${uid}`;

  return (
    <svg className="kt-uml" viewBox={`0 0 ${W} ${height}`} role="img" aria-labelledby={titleId} preserveAspectRatio="xMidYMin meet">
      <title id={titleId}>{title}</title>
      <defs>
        <marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10" className="kt-uml-arrow" />
        </marker>
        <marker id={triangle} viewBox="0 0 12 12" refX="11" refY="6" markerWidth="13" markerHeight="13" orient="auto-start-reverse">
          <path d="M0,0 L12,6 L0,12 Z" className="kt-uml-triangle" />
        </marker>
      </defs>

      {/* fronteira do sistema */}
      <rect className="kt-uml-boundary" x={CX - RX - 90} y={TOP - 36} width={(RX + 90) * 2} height={height - TOP + 6} rx="6" />
      <text className="kt-uml-system" x={CX} y={TOP - 14} textAnchor="middle">{title}</text>

      {/* associações ator — caso de uso */}
      {ordered.map((u) => (
        <g key={`a-${u.id}`} className="kt-uml-assoc">
          <line x1={78} y1={left[u.primaryActor.trim()]} x2={CX - RX} y2={yOf[u.id]} />
          {actorLines(u.secondaryActors).filter((a) => right[a] != null).map((a) => (
            <line key={a} x1={W - 78} y1={right[a]} x2={CX + RX} y2={yOf[u.id]} />
          ))}
        </g>
      ))}

      {/* «include», «extend» e generalização: arcos à direita das elipses */}
      {links.map((l, k) => {
        const y1 = yOf[l.from];
        const y2 = yOf[l.to];
        // sai pela lateral direita da elipse (θ = ±30°) e contorna por fora, sem cruzar outras elipses
        const d = 28 + (k % 4) * 24;
        const x = CX + RX * 0.866;
        const edge = CX + RX;
        const down = y2 > y1 ? 1 : -1;
        const path = `M${x},${y1 + down * RY * 0.5} C${edge + d},${y1 + down * RY} ${edge + d},${y2 - down * RY} ${x},${y2 - down * RY * 0.5}`;
        // include: seta no incluído; extend: seta no caso de uso base (Guedes, 3.9); generalização: triângulo no geral
        const endMarker = l.kind === 'include' || l.kind === 'generalization' ? `url(#${l.kind === 'include' ? arrow : triangle})` : undefined;
        const startMarker = l.kind === 'extend' ? `url(#${arrow})` : undefined;
        return (
          <g key={`l-${k}`} className={`kt-uml-link is-${l.kind}`}>
            <path d={path} markerEnd={endMarker} markerStart={startMarker} />
            {l.kind !== 'generalization' && (
              <text x={edge + d * 0.75 + 4} y={(y1 + y2) / 2 + 4} textAnchor="start" className="kt-uml-stereo">«{l.kind}»</text>
            )}
          </g>
        );
      })}

      {ordered.map((u) => {
        const lines = wrap(u.name);
        const y = yOf[u.id];
        return (
          <g key={u.id} className="kt-uml-uc">
            <ellipse cx={CX} cy={y} rx={RX} ry={RY} />
            <text x={CX} y={y - (lines.length > 1 ? 9 : 2)} textAnchor="middle" className="kt-uml-code">{u.code}</text>
            {lines.map((l, i) => (
              <text key={i} x={CX} y={y + 11 + i * 13 - (lines.length > 1 ? 6 : 0)} textAnchor="middle">{l}</text>
            ))}
          </g>
        );
      })}

      {Object.entries(left).map(([name, y]) => <Actor key={`p-${name}`} x={40} y={y} name={name} />)}
      {Object.entries(right).map(([name, y]) => <Actor key={`s-${name}`} x={W - 40} y={y} name={name} />)}
    </svg>
  );
}

// Mesmo modelo em PlantUML, para levar a outras ferramentas
export function toPlantUml(title, useCases, relations = []) {
  const alias = (u) => u.code.replace(/[^A-Za-z0-9_]/g, '_');
  const actorAlias = (name) => 'A_' + name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '_');
  const actors = [...new Set(useCases.flatMap((u) => [u.primaryActor.trim(), ...actorLines(u.secondaryActors)]))];
  const byId = Object.fromEntries(useCases.map((u) => [u.id, u]));
  const out = ['@startuml', 'left to right direction', ...actors.map((a) => `actor "${a}" as ${actorAlias(a)}`), `rectangle "${title}" {`];
  for (const u of useCases) out.push(`  usecase "${u.name}" as ${alias(u)}`);
  out.push('}');
  for (const u of useCases) {
    out.push(`${actorAlias(u.primaryActor.trim())} --> ${alias(u)}`);
    for (const s of actorLines(u.secondaryActors)) out.push(`${alias(u)} --> ${actorAlias(s)}`);
    if (u.generalUseCaseId && byId[u.generalUseCaseId]) out.push(`${alias(u)} --|> ${alias(byId[u.generalUseCaseId])}`);
  }
  for (const r of relations) {
    const from = byId[r.fromUseCaseId];
    const to = byId[r.toUseCaseId];
    if (!from || !to) continue;
    out.push(r.type === 'include' ? `${alias(from)} ..> ${alias(to)} : <<include>>` : `${alias(to)} ..> ${alias(from)} : <<extend>>`);
  }
  out.push('@enduml');
  return out.join('\n');
}
