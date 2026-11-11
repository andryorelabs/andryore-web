import type { ComponentProps } from "react";

import { cn } from "@/lib/utilities";

const VARIANT_CLASSES = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  neutral: "bg-card-2 text-foreground border border-border text-[15px] hover:-translate-y-px",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  dock: "text-muted-foreground hover:text-foreground",
} as const;

const SIZE_CLASSES = {
  default: "min-h-11 px-4 py-2",
  cta: "h-11 px-[18px]",
  icon: "size-11",
  dock: "size-8.5 min-[360px]:size-9 min-[400px]:size-11",
} as const;

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
};

/**
 * Class names of a button, for elements that must look like one but are not,
 * such as a download link.
 * @param variant The colour variant.
 * @param size The size variant.
 * @param className Extra layout classes.
 * @returns The merged class string.
 */
export function buttonClassName(
  variant: keyof typeof VARIANT_CLASSES = "default",
  size: keyof typeof SIZE_CLASSES = "default",
  className?: string,
): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={buttonClassName(variant, size, className)}
      {...props}
    />
  );
}
