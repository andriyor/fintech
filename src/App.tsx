import React from "react";

export default function App(props) {
  return (
    <div>
      <div style={{marginBottom: '12px'}}>
        <div>By Status:</div>
        <div>Captured: {props.byStatus.CAPTURED}</div>
        <div>Authorized: {props.byStatus.AUTHORIZED}</div>
        <div>Pending: {props.byStatus.PENDING}</div>
      </div>
      <div>
        <div>By source:</div>
        {Object.entries(props.bySource).map(([key, val]) => {
          return (
            <div>
              {key}: {val}
            </div>
          );
        })}
      </div>
    </div>
  );
}
