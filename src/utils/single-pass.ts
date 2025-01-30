import { Transaction } from "../types";

export const aggregate = (transactions: Transaction[]) => {
  return transactions.reduce(
    (acc, curr) => {
      acc.byStatus[curr.status] = acc.byStatus[curr.status]
        ? acc.byStatus[curr.status] + curr.amounts.order
        : curr.amounts.order;

      acc.bySource[curr.source] = acc.bySource[curr.source]
        ? acc.bySource[curr.source] + curr.amounts.order
        : curr.amounts.order;

      acc.totalTip = acc.totalTip + curr.amounts.tip;

      return acc;
    },
    { byStatus: {}, bySource: {}, totalTip: 0 }
  );
};
