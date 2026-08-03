import { Loader2, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { EmptyState } from './controls.js';
import { Card, Input } from './ui.js';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  search?: string;
  onSearchChange?: (v: string) => void;
  actions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  empty?: string;
  toolbar?: ReactNode;
  /** Cat timp e true si nu exista randuri inca, arata un indicator de incarcare in loc de mesajul de "fara inregistrari" — altfel un tabel gol la montare pare (gresit) ca nu are deloc date. */
  loading?: boolean;
}

const alignCls = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  search,
  onSearchChange,
  actions,
  onRowClick,
  empty = 'Nu exista inregistrari.',
  toolbar,
  loading = false,
}: Props<T>) {
  const cell = (row: T, c: Column<T>): ReactNode =>
    c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '');

  return (
    <Card className="overflow-hidden">
      {(onSearchChange || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {onSearchChange && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
              <Input
                className="pl-9"
                placeholder="Cauta..."
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">{toolbar}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn('px-4 py-3 font-medium text-fg-muted', alignCls[c.align ?? 'left'])}
                >
                  {c.header}
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right font-medium text-fg-muted">Actiuni</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('px-4 py-3 text-fg', alignCls[c.align ?? 'left'], c.className)}
                  >
                    {cell(row, c)}
                  </td>
                ))}
                {actions && (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: onClick aici opreste doar propagarea catre randul cu onRowClick (nu e o actiune proprie).
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && loading && (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)}>
                  <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-fg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Se incarca...
                  </div>
                </td>
              </tr>
            )}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)}>
                  <EmptyState text={empty} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
