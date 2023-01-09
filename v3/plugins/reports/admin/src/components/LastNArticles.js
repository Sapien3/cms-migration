import React from "react";

export default function LastNArticles({ lastNArticles, setLastNArticles }) {
  function changeInputValue(e) {
    const value = e.target.value;
    const newVal = value >= 1 || value === "" ? value : 1;
    setLastNArticles(newVal);
  }

  return (
    <>
      <span style={{ marginRight: "5px" }}>Process last</span>
      <input
        type="number"
        value={lastNArticles}
        onChange={changeInputValue}
        style={{ marginRight: "5px", border: "1px solid black", width: "50px" }}
      />
      <span>Articles:</span>
    </>
  );
}
