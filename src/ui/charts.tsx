// Debrief visualizations (Recharts). Pure presentation over analytics data —
// no engine or hidden state is computed here.

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PerceptionSnapshot } from '../engine/types';

const AXIS = '#7c8aa5';
const GRID = '#1e2a3d';

interface PerceptionReplayProps {
  history: PerceptionSnapshot[];
}

// The hidden ledgers over time — only ever shown after the campaign, in debrief.
export function PerceptionReplay({ history }: PerceptionReplayProps): JSX.Element {
  const data = history.map((h) => ({
    quarter: h.turn + 1,
    Threat: Math.round(h.threatPerception * 100) / 100,
    'War utility': Math.round(h.warUtility * 100) / 100,
    Resolve: Math.round(h.perceivedResolve * 100) / 100,
    Capability: Math.round(h.perceivedCapability * 100) / 100,
  }));
  return (
    <div className="chart">
      <div role="img" aria-label="Line chart of the Rival's hidden perception ledgers over the campaign">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="quarter" stroke={AXIS} fontSize={12} tickLine={false} />
            <YAxis stroke={AXIS} fontSize={12} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0d1420', border: `1px solid ${GRID}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#c9d4e5' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Threat" stroke="#e0524a" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="War utility" stroke="#f2a900" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Resolve" stroke="#4a9de0" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Capability" stroke="#5ac48a" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Non-visual equivalent of the chart for screen-reader users (§2.5.5). */}
      <table className="sr-only">
        <caption>The Rival's hidden perception ledgers by quarter</caption>
        <thead>
          <tr>
            <th scope="col">Quarter</th>
            <th scope="col">Threat</th>
            <th scope="col">War utility</th>
            <th scope="col">Resolve</th>
            <th scope="col">Capability</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.quarter}>
              <th scope="row">{d.quarter}</th>
              <td>{d.Threat}</td>
              <td>{d['War utility']}</td>
              <td>{d.Resolve}</td>
              <td>{d.Capability}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type LatticeCell = 'PEACE' | 'CRISIS' | 'WAR' | 'CAPITULATION';

const CELL_COLOR: Record<LatticeCell, string> = {
  PEACE: '#274b36',
  CRISIS: '#7a5a12',
  WAR: '#7a2019',
  CAPITULATION: '#4a2d5c',
};

const CELL_TITLE: Record<LatticeCell, string> = {
  PEACE: 'Peace',
  CRISIS: 'Crisis',
  WAR: 'War',
  CAPITULATION: 'Capitulation',
};

export interface LatticeRowData {
  label: string;
  sublabel?: string;
  lattice: LatticeCell[];
  emphasis?: boolean;
}

// The strategy lattice: one row per strategy (your play + counterfactual
// policies + type-swaps), colored by the per-quarter outcome state.
export function StrategyLattice({ rows }: { rows: LatticeRowData[] }): JSX.Element {
  const width = rows.reduce((m, r) => Math.max(m, r.lattice.length), 0);
  return (
    <div className="lattice">
      {rows.map((row, i) => (
        <div key={i} className={`lattice-row ${row.emphasis ? 'emphasis' : ''}`}>
          <div className="lattice-label">
            <span className="lattice-name">{row.label}</span>
            {row.sublabel && <span className="lattice-sub">{row.sublabel}</span>}
          </div>
          <div className="lattice-track" role="img" aria-label={`${row.label}: ${latticeSummary(row.lattice)}`}>
            {row.lattice.map((cell, t) => (
              <span
                key={t}
                className="lattice-cell"
                title={`Q${t + 1}: ${CELL_TITLE[cell]}`}
                style={{ background: CELL_COLOR[cell], width: `${100 / width}%` }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="lattice-legend">
        {(['PEACE', 'CRISIS', 'WAR', 'CAPITULATION'] as LatticeCell[]).map((c) => (
          <span key={c} className="legend-item">
            <span className="legend-swatch" style={{ background: CELL_COLOR[c] }} />
            {CELL_TITLE[c]}
          </span>
        ))}
      </div>
    </div>
  );
}

function latticeSummary(lattice: LatticeCell[]): string {
  const terminal = lattice[lattice.length - 1];
  return `ends in ${CELL_TITLE[terminal ?? 'PEACE'].toLowerCase()} after ${lattice.length} quarters`;
}
