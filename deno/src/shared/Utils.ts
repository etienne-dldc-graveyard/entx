export function notNil<T>(val: T | null | undefined): T {
  if (val === null || val === undefined) {
    throw new Error("Expected non-null value");
  }
  return val;
}
