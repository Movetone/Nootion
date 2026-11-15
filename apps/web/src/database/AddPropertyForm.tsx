import { useState } from "react";
import { CREATABLE_TYPES, type PropertyType, t } from "@nootion/shared";
import { PropertyIcon } from "./icons";
import { typeLabel } from "./format";

/** Small inline creator used by row pages; the database remains the source of truth. */
export function AddPropertyForm({
  existingNames,
  onCreate,
  onClose,
}: {
  existingNames: string[];
  onCreate: (name: string, type: PropertyType) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || existingNames.includes(trimmed) || saving) return;
    setSaving(true);
    try {
      await onCreate(trimmed, type);
      onClose();
    } finally {
      setSaving(false);
    }
  };
  const field = "w-full rounded border border-neutral-200 bg-transparent px-2 py-1 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900";
  return (
    <form
      className="space-y-2 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input autoFocus className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("property.name")} aria-label={t("property.name")} />
      <select className={field} value={type} onChange={(e) => setType(e.target.value as PropertyType)} aria-label={t("property.type")}>
        {CREATABLE_TYPES.filter((x) => x !== "plugin").map((x) => (
          <option key={x} value={x}>
            {typeLabel(x)}
          </option>
        ))}
      </select>
      <div className="flex items-center justify-end gap-2">
        <button type="button" className="rounded px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={onClose}>
          {t("common.cancel")}
        </button>
        <button type="submit" disabled={!name.trim() || existingNames.includes(name.trim()) || saving} className="rounded bg-blue-600 px-2 py-1 text-sm text-white disabled:opacity-50">
          <PropertyIcon type={type} size={14} />
          <span className="ml-1">{t("common.save")}</span>
        </button>
      </div>
    </form>
  );
}
