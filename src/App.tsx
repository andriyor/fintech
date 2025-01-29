import React from "react";

export default function App(props) {
  return (
    <div>
      <div>By Status:</div>
      <div>Captured: {props.byStatus.CAPTURED}</div>
      <div>Authorized: {props.byStatus.AUTHORIZED}</div>
      <div>Pending: {props.byStatus.PENDING}</div>
    </div>
  );
}
