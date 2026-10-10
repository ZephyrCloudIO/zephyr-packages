// Shared code: subdirectories of tools/ are never tools.
export const UNIT_PRICE = 10;

export const priceOf = (quantity: number) => quantity * UNIT_PRICE;
