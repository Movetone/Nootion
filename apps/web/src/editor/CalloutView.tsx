import { useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { IconPanel } from "../components/IconPicker";
import { pageIcon } from "../lib/icons";

/** Editable callout chrome: the emoji itself opens the full icon picker. */
export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const emoji = typeof node.attrs.emoji === "string" ? node.attrs.emoji : "";

  return (
    <NodeViewWrapper as="div" data-callout="" data-emoji={emoji} className="callout">
      <button
        type="button"
        contentEditable={false}
        className="callout-emoji"
        aria-label="Change callout icon"
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
      >
        {emoji ? pageIcon(emoji) : "＋"}
      </button>
      <NodeViewContent className="callout-content" />
      {anchor && (
        <IconPanel
          anchor={anchor}
          hasIcon={Boolean(emoji)}
          onClose={() => setAnchor(null)}
          onPick={(icon) => {
            updateAttributes({ emoji: icon ?? "" });
            setAnchor(null);
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
