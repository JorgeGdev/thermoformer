/// <reference types="astro/client" />

// TypeScript declarations for .astro files
declare module "*.astro" {
  const Component: any;
  export default Component;
}
