declare module "merge" {
  interface Merge {
    (clone: boolean, ...items: object[]): any;
    (...items: object[]): any;
    recursive: ((clone: boolean, ...items: object[]) => any) &
      ((...items: object[]) => any);
  }

  const merge: Merge;
  export default merge;
}
