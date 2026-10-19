import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui helper: merge conditional Tailwind classes. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
