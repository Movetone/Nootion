const TEXTS = {
  en: {
    placeholder: "Paste any HTTP or HTTPS page URL",
    label: "Page URL",
    embed: "Embed",
    open: "Open",
    change: "Change URL",
    invalid: "Enter a valid HTTP or HTTPS URL.",
    frame: "Interactive web page",
    hint: "Some websites block iframe embedding; use Open if the frame stays blank.",
  },
  fr: {
    placeholder: "Collez l'adresse d'une page HTTP ou HTTPS",
    label: "Adresse de la page",
    embed: "Intégrer",
    open: "Ouvrir",
    change: "Changer l'adresse",
    invalid: "Saisissez une URL HTTP ou HTTPS valide.",
    frame: "Page web interactive",
    hint: "Certains sites bloquent les iframes ; utilisez Ouvrir si le cadre reste vide.",
  },
};

export function normalizeUrl(raw) {
  const text = String(raw ?? "").trim();
  const fromIframe = text.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  const candidate = fromIframe
    ? fromIframe[1].replace(/&amp;/g, "&")
    : /^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(text)
      ? `https://${text}`
      : text;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

const box = {
  border: "1px solid rgba(128,128,128,.3)",
  borderRadius: "8px",
  overflow: "hidden",
};

export function activate(nootion) {
  const text = TEXTS[nootion.locale] ?? TEXTS.en;
  const { React } = nootion;
  const h = React.createElement;

  function UrlForm({ initial, onSubmit }) {
    const [value, setValue] = React.useState(initial ?? "");
    const [error, setError] = React.useState(null);
    const [busy, setBusy] = React.useState(false);

    const submit = async (event) => {
      event.preventDefault();
      const url = normalizeUrl(value);
      if (!url) return setError(text.invalid);
      setBusy(true);
      try {
        await onSubmit(url);
      } finally {
        setBusy(false);
      }
    };

    return h(
      "form",
      {
        onSubmit: submit,
        style: { ...box, padding: "10px", display: "flex", flexDirection: "column", gap: "8px", background: "rgba(128,128,128,.06)" },
      },
      h(
        "div",
        { style: { display: "flex", gap: "6px" } },
        h("input", {
          autoFocus: true,
          value,
          onChange: (event) => (setValue(event.target.value), setError(null)),
          placeholder: text.placeholder,
          "aria-label": text.label,
          style: { flex: 1, minWidth: 0, padding: "7px 9px", borderRadius: "6px", border: "1px solid rgba(128,128,128,.35)", background: "transparent", color: "inherit", font: "inherit" },
        }),
        h("button", {
          type: "submit",
          disabled: busy,
          style: { padding: "7px 12px", borderRadius: "6px", border: "none", background: "#b51f45", color: "white", font: "inherit", cursor: "pointer" },
        }, busy ? "…" : text.embed),
      ),
      h("div", { style: { fontSize: "12px", opacity: 0.65 } }, text.hint),
      error && h("div", { style: { color: "#dc2626", fontSize: "13px" } }, error),
    );
  }

  function Toolbar({ data, setData }) {
    const button = { padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(128,128,128,.35)", background: "rgba(255,255,255,.92)", color: "#333", fontSize: "12px", cursor: "pointer" };
    return h(
      "div",
      { className: "nootion-hover-only", style: { position: "absolute", top: "6px", right: "6px", display: "flex", gap: "4px", zIndex: 1 } },
      h("a", { href: data.url, target: "_blank", rel: "noopener noreferrer", style: { ...button, textDecoration: "none" } }, text.open),
      h("button", { type: "button", style: button, onClick: () => setData({ editing: true, url: data.url }) }, text.change),
    );
  }

  function IframeBlock({ data, setData, editable }) {
    if (!data.url || data.editing) {
      if (!editable) return null;
      return h(UrlForm, {
        initial: data.url,
        onSubmit: async (url) => setData({ url, editing: false }),
      });
    }

    return h(
      "div",
      { style: { ...box, position: "relative", background: "#111" } },
      h("iframe", {
        src: data.url,
        title: data.title || text.frame,
        loading: "lazy",
        allow: "autoplay; camera; clipboard-read; clipboard-write; fullscreen; geolocation; microphone; payment; picture-in-picture",
        allowFullScreen: true,
        referrerPolicy: "strict-origin-when-cross-origin",
        style: { display: "block", width: "100%", minHeight: "720px", border: "none", background: "white" },
      }),
      editable && h(Toolbar, { data, setData }),
    );
  }

  nootion.registerBlock("iframe", IframeBlock);
}
