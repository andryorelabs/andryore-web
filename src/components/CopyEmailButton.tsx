import { useState, type CSSProperties, type ReactElement } from "react";

import { copyWithFallback, type CopyOutcome } from "@/lib/contact";

import { Button } from "./ui/button";

interface CopyEmailButtonCopy {
  copyLabel: string;
  copiedMessage: string;
  selectedMessage: string;
}

interface CopyEmailButtonProps {
  email: string;
  targetId: string;
  copy: CopyEmailButtonCopy;
}

const RESET_DELAY_MS = 2500;
const PARTICLE_ANGLES = [0, 60, 120, 180, 240, 300] as const;

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const CopyIcon = (): ReactElement => (
  <svg {...ICON_PROPS}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);

const CheckIcon = (): ReactElement => (
  <svg {...ICON_PROPS}>
    <path d="m5 12 5 5L20 7" />
  </svg>
);

const selectElementText = (targetId: string): void => {
  const target = document.querySelector(`#${targetId}`);
  const selection = globalThis.getSelection();
  if (!target || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(target);
  selection.removeAllRanges();
  selection.addRange(range);
};

/**
 * Icon button that copies the contact email, or selects it when the clipboard
 * is unavailable, with a short particle burst on success. The result is announced through a polite live region.
 * @param props The email, the id of the element showing it and the labels.
 * @param props.email The address to copy.
 * @param props.targetId Id of the element that shows the address.
 * @param props.copy The button and status labels.
 * @returns The button and its status message.
 */
export default function CopyEmailButton({
  email,
  targetId,
  copy,
}: CopyEmailButtonProps): ReactElement {
  const [outcome, setOutcome] = useState<CopyOutcome | undefined>();

  const handleClick = async (): Promise<void> => {
    const clipboard = globalThis.navigator.clipboard as Clipboard | undefined;
    const result = await copyWithFallback(email, {
      writeText: clipboard ? (text) => clipboard.writeText(text) : undefined,
      selectText: () => {
        selectElementText(targetId);
      },
    });
    setOutcome(result);
    setTimeout(() => {
      setOutcome(undefined);
    }, RESET_DELAY_MS);
  };

  const messageByOutcome: Record<CopyOutcome, string> = {
    copied: copy.copiedMessage,
    selected: copy.selectedMessage,
  };
  const message = outcome === undefined ? "" : messageByOutcome[outcome];

  const isCopied = outcome === "copied";

  return (
    <span className="relative inline-flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 sm:size-10"
        aria-label={copy.copyLabel}
        data-copy-email
        data-sound="copy"
        onClick={() => {
          void handleClick();
        }}
      >
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      {isCopied && (
        <span
          data-particle-burst
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {PARTICLE_ANGLES.map((angle) => (
            <span
              key={angle}
              className="particle absolute top-1/2 left-1/2 size-1 rounded-full bg-primary"
              style={{ "--angle": `${String(angle)}deg` } as CSSProperties}
            />
          ))}
        </span>
      )}
      <span role="status" className="sr-only">
        {message}
      </span>
    </span>
  );
}
