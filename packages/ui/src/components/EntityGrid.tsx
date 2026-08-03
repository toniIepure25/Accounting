import { baniToRon, ronToBani } from '@gr/core-domain';
import type { Repository } from '@gr/data';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCollection } from '../hooks/useCollection.js';
import { useConfirm } from '../lib/confirm.js';
import { useToast } from '../lib/toast.js';
import { type Column, DataTable } from './DataTable.js';
import { Field, Modal, type Option, Select, Textarea } from './controls.js';
import { Button, PageHeader } from './ui.js';
import { Input } from './ui.js';

export type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'money' | 'textarea' | 'select' | 'checkbox';
  options?: Option[];
  required?: boolean;
  full?: boolean;
  /** Daca true, valoarea goala devine null (pentru coloane nullable). */
  nullable?: boolean;
};

interface Props<T extends { id: string }> {
  title: string;
  subtitle?: string;
  repo: Repository<T, Partial<T>>;
  columns: Column<T>[];
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  labelSingular?: string;
  searchable?: boolean;
  filter?: (row: T) => boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: formular generic dinamic
type FormState = Record<string, any>;

function toForm(entity: Record<string, unknown>, fields: FieldDef[]): FormState {
  const f: FormState = {};
  for (const fd of fields) {
    const v = entity[fd.name];
    f[fd.name] = fd.type === 'money' ? baniToRon((v as number) ?? 0) : (v ?? '');
  }
  return f;
}

function fromForm(form: FormState, fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const fd of fields) {
    const v = form[fd.name];
    if (fd.type === 'money') out[fd.name] = ronToBani(Number(v) || 0);
    else if (fd.type === 'number') out[fd.name] = Number(v) || 0;
    else if (fd.type === 'checkbox') out[fd.name] = Boolean(v);
    else out[fd.name] = fd.nullable && (v === '' || v == null) ? null : v;
  }
  return out;
}

/**
 * Ecran CRUD generic, data-driven: tabel + cautare + modal de adaugare/editare
 * + stergere. Sursa unica pentru toate nomenclatoarele (Date Fixe).
 */
export function EntityGrid<T extends { id: string }>({
  title,
  subtitle,
  repo,
  columns,
  fields,
  defaults,
  labelSingular = 'inregistrare',
  searchable = true,
  filter,
}: Props<T>) {
  const { rows, loading, create, update, remove } = useCollection(repo);
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({});

  const filtered = useMemo(() => {
    const base = filter ? rows.filter(filter) : rows;
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter((r) =>
      columns.some((c) => {
        const v = c.render ? '' : String((r as Record<string, unknown>)[c.key] ?? '');
        return v.toLowerCase().includes(q);
      }),
    );
  }, [rows, search, columns, filter]);

  const openNew = () => {
    setEditId(null);
    setForm(toForm(defaults, fields));
    setOpen(true);
  };
  const openEdit = (row: T) => {
    setEditId(row.id);
    setForm(toForm(row as Record<string, unknown>, fields));
    setOpen(true);
  };

  const save = async () => {
    const input = fromForm(form, fields) as Partial<T>;
    try {
      if (editId) await update(editId, input);
      else await create(input);
      setOpen(false);
      toast.success(
        editId ? `${labelSingular} a fost actualizata.` : `${labelSingular} a fost adaugata.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Salvarea ${labelSingular} a esuat.`);
    }
  };

  const del = async (row: T) => {
    const ok = await confirmDialog({
      title: `Sterge ${labelSingular}`,
      message: `Sigur stergi aceasta ${labelSingular}? Actiunea nu poate fi anulata.`,
      confirmLabel: 'Sterge',
      danger: true,
    });
    if (!ok) return;
    try {
      await remove(row.id);
      toast.success(`${labelSingular} a fost stearsa.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Stergerea ${labelSingular} a esuat.`);
    }
  };

  const set = (name: string, value: unknown) => setForm((f) => ({ ...f, [name]: value }));

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            Adauga
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        getRowKey={(r) => r.id}
        search={searchable ? search : undefined}
        onSearchChange={searchable ? setSearch : undefined}
        loading={loading}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(row)}
              title={`Editeaza ${labelSingular}`}
              aria-label={`Editeaza ${labelSingular}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => del(row)}
              title={`Sterge ${labelSingular}`}
              aria-label={`Sterge ${labelSingular}`}
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
        )}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? `Editeaza ${labelSingular}` : `Adauga ${labelSingular}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Renunta
            </Button>
            <Button onClick={save}>Salveaza</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((fd) => (
            <Field
              key={fd.name}
              label={fd.label + (fd.type === 'money' ? ' (RON)' : '')}
              className={fd.full || fd.type === 'textarea' ? 'sm:col-span-2' : ''}
            >
              {fd.type === 'select' ? (
                <Select
                  options={fd.options ?? []}
                  value={form[fd.name] ?? ''}
                  onChange={(e) => set(fd.name, e.target.value)}
                />
              ) : fd.type === 'textarea' ? (
                <Textarea
                  value={form[fd.name] ?? ''}
                  onChange={(e) => set(fd.name, e.target.value)}
                />
              ) : fd.type === 'checkbox' ? (
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary"
                  checked={Boolean(form[fd.name])}
                  onChange={(e) => set(fd.name, e.target.checked)}
                />
              ) : (
                <Input
                  type={fd.type === 'text' ? 'text' : 'number'}
                  step={fd.type === 'money' ? '0.01' : 'any'}
                  value={form[fd.name] ?? ''}
                  onChange={(e) => set(fd.name, e.target.value)}
                />
              )}
            </Field>
          ))}
        </div>
      </Modal>
    </div>
  );
}
