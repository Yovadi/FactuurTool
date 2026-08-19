export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calculateVAT(baseAmount: number, vatRate: number, vatInclusive: boolean) {
  const amount = Number(baseAmount) || 0;
  const rate = Number(vatRate) || 0;

  if (vatInclusive) {
    const total = roundMoney(amount);
    const subtotal = roundMoney(amount / (1 + rate / 100));
    const vatAmount = roundMoney(total - subtotal);
    return { subtotal, vatAmount, total };
  }

  const subtotal = roundMoney(amount);
  const vatAmount = roundMoney(amount * (rate / 100));
  const total = roundMoney(subtotal + vatAmount);
  return { subtotal, vatAmount, total };
}
