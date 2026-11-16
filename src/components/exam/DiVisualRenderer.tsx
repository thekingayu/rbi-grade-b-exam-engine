import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList
} from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp, Table2, FileText, Layers } from 'lucide-react';
import { DiChartPanel, DiGroupData } from '../../types';
import { clsx } from 'clsx';

const DI_PALETTE_LIGHT = ['#0D47FF', '#0D9488', '#D97706', '#DB2777', '#7C3AED', '#059669', '#DC2626'];
const DI_PALETTE_DARK = ['#60A5FA', '#2DD4BF', '#FBBF24', '#F472B6', '#C084FC', '#34D399', '#F87171'];

function useIsDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function getDiMetaBadge(diType: DiGroupData['diType']) {
  switch (diType) {
    case 'pie':
      return { label: 'PIE CHART DI', icon: PieIcon };
    case 'double_pie':
      return { label: 'DOUBLE PIE DI', icon: PieIcon };
    case 'bar_vertical':
      return { label: 'VERTICAL BAR GRAPH', icon: BarChart3 };
    case 'bar_horizontal':
      return { label: 'HORIZONTAL BAR GRAPH', icon: BarChart3 };
    case 'line':
      return { label: 'LINE GRAPH DI', icon: TrendingUp };
    case 'table':
      return { label: 'TABULAR DI', icon: Table2 };
    case 'caselet':
      return { label: 'CASELET PASSAGE DI', icon: FileText };
    case 'mixed':
    default:
      return { label: 'MIXED COMBINATION DI', icon: Layers };
  }
}

function resolveKeys(panel: DiChartPanel) {
  const rows = Array.isArray(panel.data) ? panel.data : [];
  const sample = rows[0] || {};
  const keys = Object.keys(sample);
  const categoryKey =
    panel.categoryKey && keys.includes(panel.categoryKey)
      ? panel.categoryKey
      : keys.find(k => typeof sample[k] === 'string') || keys[0] || 'label';

  const seriesKeys =
    panel.seriesKeys && panel.seriesKeys.length > 0
      ? panel.seriesKeys
      : keys.filter(k => k !== categoryKey);

  return { categoryKey, seriesKeys, rows };
}

interface DiChartSinglePanelProps {
  panel: DiChartPanel;
  isDark: boolean;
  compact?: boolean;
}

const DiChartSinglePanel: React.FC<DiChartSinglePanelProps> = ({ panel, isDark, compact = false }) => {
  const palette = isDark ? DI_PALETTE_DARK : DI_PALETTE_LIGHT;
  const gridStroke = isDark ? '#2E2E2A' : '#E5E1CE';
  const tickColor = isDark ? '#D4D0C5' : '#4A4942';
  const tooltipBg = isDark ? '#141413' : '#FFFFFF';
  const tooltipBorder = isDark ? '#3F3F38' : '#141413';
  const tooltipText = isDark ? '#FAF8EC' : '#141413';

  const { categoryKey, seriesKeys, rows } = resolveKeys(panel);
  const unitSuffix = panel.unit ? (panel.unit === '%' || panel.unit === '°' ? panel.unit : ` ${panel.unit}`) : '';
  const showDirectLabels = rows.length * Math.max(1, seriesKeys.length) <= 12;

  if (panel.chartType === 'table') {
    const tableRows = Array.isArray(panel.rows) && panel.rows.length > 0 ? panel.rows : rows;
    const cols =
      panel.columns && panel.columns.length > 0
        ? panel.columns
        : tableRows[0]
          ? Object.keys(tableRows[0])
          : [];

    return (
      <div className="bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-3.5 sm:p-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h4 className="text-xs sm:text-sm font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
              {panel.title}
            </h4>
            {panel.subtitle && (
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">{panel.subtitle}</p>
            )}
          </div>
          {panel.totalLabel && (
            <span className="px-2 py-0.5 rounded-md bg-[#ECD5FF] text-[#141413] border border-[#141413] text-[10px] font-mono font-bold tabular-nums">
              {panel.totalLabel}
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#E5E1CE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#1C1C1A]">
          <table className="w-full text-left border-collapse text-xs sm:text-[13px] tabular-nums">
            <thead>
              <tr className="bg-[#141413] dark:bg-[#262622] text-[#FAF8EC]">
                {cols.map(col => (
                  <th
                    key={col}
                    className="px-3 py-2.5 font-mono font-bold text-[11px] uppercase tracking-wider whitespace-nowrap border-b border-[#2E2E2A]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, rIdx) => (
                <tr
                  key={rIdx}
                  className={clsx(
                    'border-b last:border-b-0 border-[#E5E1CE] dark:border-[#2E2E2A]',
                    rIdx % 2 === 1 ? 'bg-[#FAF8EC]/60 dark:bg-[#141413]/40' : ''
                  )}
                >
                  {cols.map((col, cIdx) => {
                    const val = r[col];
                    const strVal = val === undefined || val === null ? '—' : String(val);
                    const isMissing = strVal === '?' || strVal === '-' || strVal === '—' || strVal.toLowerCase() === 'missing';
                    return (
                      <td
                        key={col}
                        className={clsx(
                          'px-3 py-2 whitespace-nowrap',
                          cIdx === 0
                            ? 'font-bold text-[#141413] dark:text-[#FAF8EC]'
                            : isMissing
                              ? 'font-mono font-bold text-amber-700 dark:text-amber-300 bg-[#FFD426]/20'
                              : 'font-mono font-medium text-[#141413] dark:text-[#FAF8EC]'
                        )}
                      >
                        {strVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (panel.chartType === 'pie') {
    const valKey = seriesKeys[0] || Object.keys(rows[0] || {}).find(k => k !== categoryKey) || 'value';
    const pieData = rows.map(r => ({
      name: String(r[categoryKey] ?? ''),
      value: Number(r[valKey]) || 0
    }));

    return (
      <div className="bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-3.5 sm:p-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <h4 className="text-xs sm:text-sm font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
              {panel.title}
            </h4>
            {panel.subtitle && (
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">{panel.subtitle}</p>
            )}
          </div>
          {panel.totalLabel && (
            <span className="px-2 py-0.5 rounded-md bg-[#FFD426] text-[#141413] border border-[#141413] text-[10px] font-mono font-bold tabular-nums">
              {panel.totalLabel}
            </span>
          )}
        </div>

        <div className="w-full" style={{ height: compact ? 200 : 230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={compact ? 24 : 30}
                outerRadius={compact ? 64 : 78}
                paddingAngle={2}
                stroke={isDark ? '#141413' : '#FAF8EC'}
                strokeWidth={2}
                label={({ value }) => `${value}${unitSuffix}`}
                labelLine={{ stroke: tickColor, strokeWidth: 1 }}
              >
                {pieData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: any) => [`${val}${unitSuffix}`, valKey]}
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1.5px solid ${tooltipBorder}`,
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: tooltipText,
                  fontFamily: 'ui-monospace, monospace'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Exact Readout Legend (always legible without hovering) */}
        <div className="mt-2 pt-2.5 border-t border-[#E5E1CE] dark:border-[#2E2E2A] grid grid-cols-2 gap-x-3 gap-y-1.5">
          {pieData.map((entry, idx) => (
            <div key={entry.name + idx} className="flex items-center justify-between gap-1.5 text-[11px] min-w-0">
              <span className="flex items-center gap-1.5 min-w-0 text-[#5C5A52] dark:text-[#D4D0C5] truncate">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: palette[idx % palette.length] }}
                />
                <span className="truncate font-medium">{entry.name}</span>
              </span>
              <span className="font-mono font-bold text-[#141413] dark:text-[#FAF8EC] shrink-0 tabular-nums">
                {entry.value}{unitSuffix}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (panel.chartType === 'bar_horizontal') {
    return (
      <div className="bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-3.5 sm:p-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <h4 className="text-xs sm:text-sm font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
              {panel.title}
            </h4>
            {panel.subtitle && (
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">{panel.subtitle}</p>
            )}
          </div>
          {panel.totalLabel && (
            <span className="px-2 py-0.5 rounded-md bg-[#ECD5FF] text-[#141413] border border-[#141413] text-[10px] font-mono font-bold tabular-nums">
              {panel.totalLabel}
            </span>
          )}
        </div>

        <div className="w-full" style={{ height: compact ? 230 : 275 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 8, right: 32, left: 6, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: tickColor, fontSize: 11 }}
                tickFormatter={(v) => `${v}${panel.unit === '%' ? '%' : ''}`}
              />
              <YAxis
                type="category"
                dataKey={categoryKey}
                width={80}
                tick={{ fill: tickColor, fontSize: 11, fontWeight: 600 }}
              />
              <Tooltip
                formatter={(val: any, name: any) => [`${val}${unitSuffix}`, name]}
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1.5px solid ${tooltipBorder}`,
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: tooltipText,
                  fontFamily: 'ui-monospace, monospace'
                }}
              />
              {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
              {seriesKeys.map((sKey, sIdx) => (
                <Bar
                  key={sKey}
                  dataKey={sKey}
                  fill={palette[sIdx % palette.length]}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                >
                  {showDirectLabels && (
                    <LabelList
                      dataKey={sKey}
                      position="right"
                      fill={tickColor}
                      fontSize={10}
                      formatter={(v: any) => `${v}${panel.unit === '%' ? '%' : ''}`}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {(panel.xAxisLabel || panel.yAxisLabel) && (
          <p className="text-[10px] font-mono text-[#66665E] dark:text-[#A3A399] text-center mt-1">
            {[panel.yAxisLabel, panel.xAxisLabel].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    );
  }

  if (panel.chartType === 'line') {
    return (
      <div className="bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-3.5 sm:p-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <h4 className="text-xs sm:text-sm font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
              {panel.title}
            </h4>
            {panel.subtitle && (
              <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">{panel.subtitle}</p>
            )}
          </div>
          {panel.totalLabel && (
            <span className="px-2 py-0.5 rounded-md bg-[#ECD5FF] text-[#141413] border border-[#141413] text-[10px] font-mono font-bold tabular-nums">
              {panel.totalLabel}
            </span>
          )}
        </div>

        <div className="w-full" style={{ height: compact ? 230 : 275 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 18, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey={categoryKey}
                tick={{ fill: tickColor, fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                tick={{ fill: tickColor, fontSize: 11 }}
                tickFormatter={(v) => `${v}${panel.unit === '%' ? '%' : ''}`}
                width={44}
              />
              <Tooltip
                formatter={(val: any, name: any) => [`${val}${unitSuffix}`, name]}
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1.5px solid ${tooltipBorder}`,
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: tooltipText,
                  fontFamily: 'ui-monospace, monospace'
                }}
              />
              {seriesKeys.length > 0 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
              {seriesKeys.map((sKey, sIdx) => (
                <Line
                  key={sKey}
                  type="monotone"
                  dataKey={sKey}
                  stroke={palette[sIdx % palette.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: palette[sIdx % palette.length], strokeWidth: 1.5, stroke: isDark ? '#141413' : '#FFFFFF' }}
                  activeDot={{ r: 6 }}
                >
                  {seriesKeys.length === 1 && (
                    <LabelList
                      dataKey={sKey}
                      position="top"
                      fill={tickColor}
                      fontSize={10}
                      formatter={(v: any) => `${v}${panel.unit === '%' ? '%' : ''}`}
                    />
                  )}
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tabular readout strip beneath multi-series line graphs so exact values are never hidden */}
        {seriesKeys.length > 1 && rows.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#E5E1CE] dark:border-[#2E2E2A] overflow-x-auto">
            <table className="w-full text-[11px] font-mono tabular-nums text-left">
              <thead>
                <tr className="text-[#66665E] dark:text-[#A3A399]">
                  <th className="py-1 pr-2 font-bold">{categoryKey}</th>
                  {rows.map((r, i) => (
                    <th key={i} className="py-1 px-1.5 font-bold text-right text-[#141413] dark:text-[#FAF8EC]">
                      {String(r[categoryKey] ?? '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seriesKeys.map((sKey, sIdx) => (
                  <tr key={sKey} className="border-t border-[#E5E1CE]/60 dark:border-[#2E2E2A]/60">
                    <td className="py-1 pr-2 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: palette[sIdx % palette.length] }} />
                      <span className="text-[#141413] dark:text-[#FAF8EC]">{sKey}</span>
                    </td>
                    {rows.map((r, i) => (
                      <td key={i} className="py-1 px-1.5 text-right text-[#141413] dark:text-[#FAF8EC]">
                        {String(r[sKey] ?? '—')}{panel.unit === '%' ? '%' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Default: Vertical Bar Graph ('bar_vertical')
  return (
    <div className="bg-[#FAF8EC] dark:bg-[#141413] border-[1.5px] border-[#E5E1CE] dark:border-[#2E2E2A] rounded-2xl p-3.5 sm:p-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h4 className="text-xs sm:text-sm font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC]">
            {panel.title}
          </h4>
          {panel.subtitle && (
            <p className="text-[11px] text-[#66665E] dark:text-[#A3A399]">{panel.subtitle}</p>
          )}
        </div>
        {panel.totalLabel && (
          <span className="px-2 py-0.5 rounded-md bg-[#ECD5FF] text-[#141413] border border-[#141413] text-[10px] font-mono font-bold tabular-nums">
            {panel.totalLabel}
          </span>
        )}
      </div>

      <div className="w-full" style={{ height: compact ? 230 : 275 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 20, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey={categoryKey}
              tick={{ fill: tickColor, fontSize: 11, fontWeight: 600 }}
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 11 }}
              tickFormatter={(v) => `${v}${panel.unit === '%' ? '%' : ''}`}
              width={44}
            />
            <Tooltip
              formatter={(val: any, name: any) => [`${val}${unitSuffix}`, name]}
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1.5px solid ${tooltipBorder}`,
                borderRadius: '10px',
                fontSize: '12px',
                color: tooltipText,
                fontFamily: 'ui-monospace, monospace'
              }}
            />
            {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
            {seriesKeys.map((sKey, sIdx) => (
              <Bar
                key={sKey}
                dataKey={sKey}
                fill={palette[sIdx % palette.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              >
                {showDirectLabels && (
                  <LabelList
                    dataKey={sKey}
                    position="top"
                    fill={tickColor}
                    fontSize={10}
                    formatter={(v: any) => `${v}${panel.unit === '%' ? '%' : ''}`}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!showDirectLabels && rows.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#E5E1CE] dark:border-[#2E2E2A] overflow-x-auto">
          <table className="w-full text-[11px] font-mono tabular-nums text-left">
            <thead>
              <tr className="text-[#66665E] dark:text-[#A3A399]">
                <th className="py-1 pr-2 font-bold">{categoryKey}</th>
                {rows.map((r, i) => (
                  <th key={i} className="py-1 px-1.5 font-bold text-right text-[#141413] dark:text-[#FAF8EC]">
                    {String(r[categoryKey] ?? '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seriesKeys.map((sKey, sIdx) => (
                <tr key={sKey} className="border-t border-[#E5E1CE]/60 dark:border-[#2E2E2A]/60">
                  <td className="py-1 pr-2 font-semibold flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: palette[sIdx % palette.length] }} />
                    <span className="text-[#141413] dark:text-[#FAF8EC]">{sKey}</span>
                  </td>
                  {rows.map((r, i) => (
                    <td key={i} className="py-1 px-1.5 text-right text-[#141413] dark:text-[#FAF8EC]">
                      {String(r[sKey] ?? '—')}{panel.unit === '%' ? '%' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface DiVisualRendererProps {
  diGroup: DiGroupData;
  activeSetIndex?: number;
  activeSetTotal?: number;
  compact?: boolean;
}

export const DiVisualRenderer: React.FC<DiVisualRendererProps> = ({
  diGroup,
  activeSetIndex,
  activeSetTotal,
  compact = false
}) => {
  const isDark = useIsDarkMode();
  const meta = getDiMetaBadge(diGroup.diType);
  const MetaIcon = meta.icon;
  const charts = Array.isArray(diGroup.charts) ? diGroup.charts : [];
  const isCaseletOnly = diGroup.diType === 'caselet' || charts.length === 0;

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#1C1C1A] border-[1.5px] border-[#141413] dark:border-[#2E2E2A] shadow-[4px_4px_0px_#141413] dark:shadow-[4px_4px_0px_#ECD5FF] rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 min-w-0">
      {/* Set Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#E5E1CE] dark:border-[#2E2E2A]">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#ECD5FF] text-[#141413] border border-[#141413] text-[10px] font-mono font-bold uppercase tracking-wider">
              <MetaIcon className="w-3 h-3 shrink-0" />
              <span>{meta.label}</span>
            </span>
            {typeof activeSetIndex === 'number' && typeof activeSetTotal === 'number' && (
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFD426] text-[#141413] border border-[#141413] text-[10px] font-mono font-bold uppercase tracking-wider tabular-nums">
                Set Q{activeSetIndex}/{activeSetTotal}
              </span>
            )}
          </div>
          <h3 className="text-sm sm:text-base font-heading font-extrabold text-[#141413] dark:text-[#FAF8EC] leading-snug">
            {diGroup.setTitle}
          </h3>
        </div>
      </div>

      {/* Directions / Caselet Passage */}
      {diGroup.directions && (
        <div
          className={clsx(
            'rounded-2xl border p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap',
            isCaseletOnly
              ? 'bg-[#FAF8EC] dark:bg-[#141413] border-[#141413] dark:border-[#ECD5FF]/40 text-[#141413] dark:text-[#FAF8EC] font-medium'
              : 'bg-[#FAF8EC]/80 dark:bg-[#141413]/75 border-[#E5E1CE] dark:border-[#2E2E2A] text-[#4A4942] dark:text-[#D4D0C5]'
          )}
        >
          {diGroup.directions}
        </div>
      )}

      {/* Additional Constraints / Notes */}
      {diGroup.notes && diGroup.notes.length > 0 && (
        <div className="bg-[#FFD426]/15 dark:bg-[#FFD426]/10 border border-[#141413]/20 dark:border-[#FFD426]/30 rounded-xl px-3.5 py-2.5 space-y-1">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#141413] dark:text-[#FFD426]">
            Given Conditions & Formula Notes
          </p>
          <ul className="space-y-0.5 text-xs text-[#141413] dark:text-[#FAF8EC]">
            {diGroup.notes.map((note, idx) => (
              <li key={idx} className="leading-snug">
                • {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chart Exhibits */}
      {!isCaseletOnly && (
        <div
          className={clsx(
            'grid gap-4',
            charts.length > 1 && !compact ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2' : 'grid-cols-1'
          )}
        >
          {charts.map((panel, idx) => (
            <DiChartSinglePanel
              key={`${diGroup.groupId}-panel-${idx}`}
              panel={panel}
              isDark={isDark}
              compact={compact}
            />
          ))}
        </div>
      )}

      {isCaseletOnly && (
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] font-mono text-[#66665E] dark:text-[#A3A399]">
          <span>Caselet Tip: Tabulate variables & totals before solving Q1–Q{activeSetTotal || 5}</span>
        </div>
      )}
    </div>
  );
};
