export const toCityId = (name: string, country: string) =>
  `${name}-${country}`.toLowerCase().replace(/\s+/g, '-')
