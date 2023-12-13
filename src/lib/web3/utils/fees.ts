export interface FeeType {
  fee: number;
  label: string;
  description: string;
}

export const feeTypes: Array<FeeType> = Object.entries({
  '0.01%': 'Best for very stable pairs',
  '0.05%': 'Best for stable pairs',
  '0.20%': 'Best for most assets',
  '1.00%': 'Best for exotic assets',
}).map(([label, description]) => ({
  label,
  fee: Number(label.replace(/%$/, '')) * 100,
  description,
}));
