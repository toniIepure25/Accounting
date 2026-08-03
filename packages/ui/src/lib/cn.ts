import { type ClassValue, clsx } from 'clsx';

/** Helper pentru compunerea claselor Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
