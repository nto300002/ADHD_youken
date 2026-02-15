// Mock nanoid for Jest
let counter = 0;

export function nanoid(): string {
  return `test-id-${++counter}`;
}
