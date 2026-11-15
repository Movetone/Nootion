import { Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { atLeast, type CellValue, type DatabaseProperty, type DatabaseRow, type PageRole, type RelatedRow, type SelectOption } from "@nootion/shared";
import { api } from "../lib/api";
import { sendOrQueue, useOfflineQueue, withQueuedRow } from "../lib/offline";
import { Cell } from "./Cell";
import { PropertyIcon } from "./icons";
import { newOption } from "./OptionPicker";
import { Popover } from "./Popover";
import { AddPropertyForm } from "./AddPropertyForm";
import { PropertyMenu } from "./PropertyMenu";
import { t, type PropertyType } from "@nootion/shared";

interface RowData {
  properties: DatabaseProperty[];
  row: DatabaseRow;
  role: PageRole;
  people: Record<string, string>;
  related: Record<string, RelatedRow>;
  rollupTargets: Record<string, DatabaseProperty | null>;
}

/** Property list shown above the content of a database row opened as a page. */
export function RowProperties({ databaseId, rowId }: { databaseId: string; rowId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState<HTMLElement | null>(null);
  const [propertyMenu, setPropertyMenu] = useState<{ prop: DatabaseProperty; anchor: HTMLElement } | null>(null);
  const key = ["database-row", rowId] as const;
  const { pending } = useOfflineQueue();
  const q = useQuery({
    queryKey: key,
    queryFn: () => api<RowData>(`/databases/${databaseId}/rows/${rowId}`),
    // Values changed offline show until the server has them.
    select: pending ? (d: RowData) => ({ ...d, row: withQueuedRow(databaseId, d.row) }) : undefined,
  });

  const update = useMutation({
    mutationFn: ({ propId, value }: { propId: string; value: CellValue }) =>
      sendOrQueue<{ row: DatabaseRow; related: Record<string, RelatedRow> }>(`/databases/${databaseId}/rows/${rowId}`, { values: { [propId]: value } }),
    onMutate: ({ propId, value }) => qc.setQueryData<RowData>(key, (d) => (d ? { ...d, row: { ...d.row, values: { ...d.row.values, [propId]: value } } } : d)),
    onSuccess: (res) => res && qc.setQueryData<RowData>(key, (d) => (d ? { ...d, row: res.row, related: { ...d.related, ...res.related } } : d)),
    onError: (err) => alert(err instanceof Error ? err.message : String(err)),
    // Relations and rollups can show this row in other databases too.
    onSettled: () => qc.invalidateQueries({ queryKey: ["database"] }),
  });

  const addProperty = async (name: string, type: PropertyType) => {
    await api<{ property: DatabaseProperty }>(`/databases/${databaseId}/properties`, { method: "POST", body: { name, type, config: {} } });
    await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ["database", databaseId] })]);
  };

  const updateProperty = async (propId: string, body: { name?: string; type?: PropertyType; config?: DatabaseProperty["config"]; position?: number }) => {
    await api(`/databases/${databaseId}/properties/${propId}`, { method: "PATCH", body });
    await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ["database", databaseId] })]);
  };

  const deleteProperty = async (propId: string) => {
    await api(`/databases/${databaseId}/properties/${propId}`, { method: "DELETE" });
    setPropertyMenu(null);
    await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ["database", databaseId] })]);
  };

  const moveProperty = async (prop: DatabaseProperty, direction: -1 | 1) => {
    const ordered = properties.filter((p) => p.type !== "title");
    const index = ordered.findIndex((p) => p.id === prop.id);
    const other = ordered[index + direction];
    if (!other) return;
    await Promise.all([updateProperty(prop.id, { position: other.position }), updateProperty(other.id, { position: prop.position })]);
  };

  if (!q.data) return null;
  const { properties, row, role, people, related, rollupTargets } = q.data;
  const editable = atLeast(role, "editor");

  const createOption =
    (prop: DatabaseProperty) =>
    async (name: string): Promise<SelectOption> => {
      const options = prop.config.options ?? [];
      const o = newOption(name, options);
      await api(`/databases/${databaseId}/properties/${prop.id}`, { method: "PATCH", body: { config: { ...prop.config, options: [...options, o] } } });
      await qc.invalidateQueries({ queryKey: key });
      return o;
    };

  return (
    <div className="mt-4 space-y-0.5 border-b border-neutral-200 pb-4 text-sm dark:border-neutral-800" aria-label={t("row.properties")}>
      {properties
        .filter((p) => p.type !== "title")
        .map((p) => (
          <div key={p.id} className="group flex items-start gap-2">
            <div className="flex w-32 shrink-0 items-center gap-1.5 truncate py-1.5 text-neutral-500 sm:w-40">
              <PropertyIcon type={p.type} size={14} /> <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {editable && (
                <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    title="Move property up"
                    aria-label="Move property up"
                    disabled={properties.filter((x) => x.type !== "title")[0]?.id === p.id}
                    onClick={() => void moveProperty(p, -1)}
                    className="rounded p-0.5 hover:bg-neutral-200 disabled:opacity-30 dark:hover:bg-neutral-700"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    title="Move property down"
                    aria-label="Move property down"
                    disabled={properties.filter((x) => x.type !== "title").at(-1)?.id === p.id}
                    onClick={() => void moveProperty(p, 1)}
                    className="rounded p-0.5 hover:bg-neutral-200 disabled:opacity-30 dark:hover:bg-neutral-700"
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button
                    type="button"
                    title="Property settings"
                    aria-label="Property settings"
                    onClick={(e) => setPropertyMenu({ prop: p, anchor: e.currentTarget })}
                    className="rounded p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <Settings2 size={12} />
                  </button>
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Cell
                prop={p}
                value={row.values[p.id] ?? null}
                rowId={row.id}
                databaseId={databaseId}
                people={people}
                related={related}
                rollupTarget={rollupTargets[p.id]}
                editable={editable}
                variant="panel"
                onChange={(value) => update.mutate({ propId: p.id, value })}
                onCreateOption={createOption(p)}
              />
            </div>
          </div>
        ))}
      {editable && (
        <>
          <button
            type="button"
            className="mt-2 rounded px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            onClick={(e) => setAdding(e.currentTarget)}
          >
            + {t("table.addProperty")}
          </button>
          {adding && (
            <Popover anchor={adding} onClose={() => setAdding(null)} width={240}>
              <AddPropertyForm existingNames={properties.map((p) => p.name)} onCreate={addProperty} onClose={() => setAdding(null)} />
            </Popover>
          )}
          {propertyMenu && (
            <Popover anchor={propertyMenu.anchor} onClose={() => setPropertyMenu(null)} width={280}>
              <PropertyMenu
                prop={propertyMenu.prop}
                properties={properties}
                databaseId={databaseId}
                onRename={(name) => void updateProperty(propertyMenu.prop.id, { name })}
                onChangeType={(type) => void updateProperty(propertyMenu.prop.id, { type })}
                onChangeConfig={(config) => void updateProperty(propertyMenu.prop.id, { config })}
                onDelete={() => void deleteProperty(propertyMenu.prop.id)}
              />
            </Popover>
          )}
        </>
      )}
    </div>
  );
}
