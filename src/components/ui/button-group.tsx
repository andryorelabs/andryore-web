import type { ComponentProps } from "react";

import { cn } from "@/lib/utilities";

/**
 * Joins adjacent buttons into one segmented control; the outer corners keep
 * the buttons' own radius.
 * @param props Div props.
 * @param props.className Extra layout classes.
 * @returns The grouped container.
 */
export function ButtonGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="button-group"
      className={cn(
        "flex w-fit items-stretch [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none",
        className,
      )}
      {...props}
    />
  );
}
