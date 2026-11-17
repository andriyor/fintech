import React from "react";

import { Source, Status } from "./types";

type Resutl = {
  byStatus: Record<Status, number>;
  bySource: Record<Source, number>;
  totalTip: number;
};

export default function ReportView(props: { result: Resutl }) {
  return (
    <div>
      <div style={{ marginBottom: "12px" }}>
        <div>By Status:</div>
        <div>Captured: {props.result.byStatus.CAPTURED}</div>
        <div>Authorized: {props.result.byStatus.AUTHORIZED}</div>
        <div>Pending: {props.result.byStatus.PENDING}</div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <div>By source:</div>
        {Object.entries(props.result.bySource).map(([key, val]) => {
          return (
            <div key={key}>
              {key}: {val}
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: "12px" }}>
        Total tip: {props.result.totalTip}
      </div>
    </div>
  );
}
