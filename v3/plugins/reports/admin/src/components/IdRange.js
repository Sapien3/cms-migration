import React from "react";

export default function IdRange({ idRange, setIdRange }) {
  const inputStyle = {
    marginRight: "5px",
    border: "1px solid black",
    width: "150px",
  };

  return (
    <>
      <span style={{ marginRight: "5px" }}>Process Articles between IDs </span>
      <input
        type="text"
        value={idRange[0]}
        onChange={(e) => setIdRange([e.target.value, idRange[1]])}
        style={inputStyle}
        placeholder="starting id"
      />
      <input
        type="text"
        value={idRange[1]}
        onChange={(e) => setIdRange([idRange[0], e.target.value])}
        style={inputStyle}
        placeholder="ending id"
      />
      <span>:</span>
    </>
  );
}
