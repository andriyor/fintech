import { Transaction } from "../types";

const amountByStatus = (transactions: Transaction[]) => {
  return transactions.reduce((acc, curr) => {
    acc[curr.status] = acc[curr.status]
      ? acc[curr.status] + curr.amounts.order
      : curr.amounts.order;
    return acc;
  }, {});
};

const amountBySource = (transactions: Transaction[]) => {
  return transactions.reduce((acc, curr) => {
    acc[curr.source] = acc[curr.source]
      ? acc[curr.source] + curr.amounts.order
      : curr.amounts.order;
    return acc;
  }, {});
};

export const aggregate = (transactions: Transaction[]) => {
  const byStatus = amountByStatus(transactions);
  const bySource = amountBySource(transactions);
  return {
    byStatus,
    bySource,
  };
};
