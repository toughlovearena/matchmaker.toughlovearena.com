export function sleep(ms: number) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function compare(a: string | number, b: string | number) {
  if (a < b) { return -1; }
  if (a > b) { return 1; }
  return 0;
}
export function sortArrayOfObjects<T>(arr: T[], cb: ((obj: T) => string | number)): T[] {
  arr.sort((a, b) => compare(cb(a), cb(b)));
  return arr;
}
