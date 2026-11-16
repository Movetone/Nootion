import { useState } from "react";
import { CREATABLE_TYPES, t, type DatabaseData, type DatabaseProperty, type PropertyConfig, type PropertyType } from "@nootion/shared";
import { useDatabaseList } from "./hooks";
import { usePluginPropertyTypes } from "../plugins/registry";
import { pageTitle } from "../lib/tree";
import { pageIcon } from "../lib/icons";
import { typeLabel } from "./format";
import { PropertyIcon } from "./icons";

export function uniquePropertyName(data: Pick<DatabaseData, "properties">, type: string) {
  const names = new Set(data.properties.map((p) => p.name));
  let name = type;
  let n = 2;
  while (names.has(name)) name = `${type} ${n++}`;
  return name;
}

export function DatabasePropertyPicker({
  data,
  onCreate,
}: {
  data: Pick<DatabaseData, "id" | "title" | "properties">;
  onCreate: (input: { name: string; type: PropertyType; config?: PropertyConfig; twoWay?: boolean }) => Promise<DatabaseProperty | undefined>;
}) {
  const [relation, setRelation] = useState(false);
  const plugins = usePluginPropertyTypes();
  if (relation) {
    return <RelationSetup data={data} onCreate={onCreate} onBack={() => setRelation(false)} />;
  }
  return (
    <div className="max-h-80 overflow-y-auto">
      <div className="px-2 py-1 text-xs text-neutral-500">{t("table.newColumnType")}</div>
      {CREATABLE_TYPES.filter((type) => type !== "plugin").map((type) => (
        <button
          key={type}
          onClick={() => {
            if (type === "relation") return setRelation(true);
            void onCreate({ name: uniquePropertyName(data, typeLabel(type)), type });
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <PropertyIcon type={type} size={14} /> {typeLabel(type)}
        </button>
      ))}
      {plugins.map((pt) => (
        <button
          key={`${pt.pluginId}.${pt.id}`}
          title={pt.description}
          onClick={() => void onCreate({ name: uniquePropertyName(data, pt.name), type: "plugin", config: { plugin: { id: pt.pluginId, type: pt.id } } })}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <span className="w-3.5 text-center text-xs">{pt.icon}</span> {pt.name}
        </button>
      ))}
    </div>
  );
}

function RelationSetup({
  data,
  onCreate,
  onBack,
}: {
  data: Pick<DatabaseData, "id" | "title" | "properties">;
  onCreate: (input: { name: string; type: PropertyType; config?: PropertyConfig; twoWay?: boolean }) => Promise<DatabaseProperty | undefined>;
  onBack: () => void;
}) {
  const list = useDatabaseList();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ id: string; title: string } | null>(null);
  const [twoWay, setTwoWay] = useState(true);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (picked) {
    const self = picked.id === data.id;
    return (
      <div className="space-y-2 p-1">
        <p>{t("relation.to")} <span className="font-medium">{pageTitle(picked.title)}</span></p>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={twoWay} onChange={(e) => setTwoWay(e.target.checked)} />
          <span>
            {t("relation.alsoShowIn")} {self ? t("relation.thisDatabase") : <span className="font-medium">{pageTitle(picked.title)}</span>}
            <span className="block text-xs text-neutral-500">{t("relation.twoWayHelp", { name: pageTitle(data.title) })}</span>
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={() => setPicked(null)} className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">{t("common.back")}</button>
          <button onClick={async () => { await onCreate({ name: uniquePropertyName(data, pageTitle(picked.title)), type: "relation", config: { databaseId: picked.id }, twoWay }); }} className="rounded bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900">{t("relation.create")}</button>
        </div>
      </div>
    );
  }
  const databases = (list.data ?? []).filter((d) => norm(pageTitle(d.title)).includes(norm(query)));
  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500">
        <button onClick={onBack} className="rounded px-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">←</button>
        {t("relation.which")}
      </div>
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("relation.search")} className="mb-1 w-full rounded border border-neutral-200 bg-transparent px-2 py-1.5 outline-none focus:border-neutral-400 dark:border-neutral-700" />
      <div className="max-h-64 overflow-y-auto">
        {databases.map((d) => (
          <button key={d.id} onClick={() => setPicked(d)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800">
            <span className="w-4 text-center">{pageIcon(d.icon) ?? "🗃"}</span>
            <span className="truncate">{pageTitle(d.title)}{d.id === data.id && <span className="text-neutral-400"> ({t("relation.thisDatabase")})</span>}</span>
          </button>
        ))}
        {list.data && !databases.length && <p className="px-2 py-1 text-neutral-500">{t("relation.none")}</p>}
      </div>
    </div>
  );
}
