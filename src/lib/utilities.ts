import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names and resolves conflicting Tailwind utilities, the `cn`
 * helper shadcn/ui components expect.
 * @param inputs Class values accepted by `clsx`.
 * @returns One class string, the last conflicting utility winning.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
