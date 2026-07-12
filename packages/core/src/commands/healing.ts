export interface HealingResult {
  selector: string;
  found: boolean;
  attempt: number;
}

export function healSelector(
  primarySelector: string,
  fallbacks: string[] = []
): string[] {
  return [primarySelector, ...fallbacks];
}
