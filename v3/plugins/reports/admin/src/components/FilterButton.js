import React, { useState } from "react";

const styles = {
  btn1: {
    border: "1px black solid",
    marginLeft: "10px",
    marginBottom: "10px",
    padding: "1px 5px",
    backgroundColor: "white",
    display: "block",
  },
  btn2: {
    backgroundColor: "#74afb9",
    padding: "5px 10px",
    color: "white",
    marginLeft: "10px",
  },
  popup: {
    border: "1px black solid",
    marginLeft: "10px",
    marginBottom: "10px",
    padding: "2px 5px",
    backgroundColor: "#eee",
    width: "max-content",
  },
};

export default function FilterButton({ currentFilter, setCurrentFilter }) {
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [localFilter, setLocalFilter] = useState(currentFilter);

  function handleApplyBtn() {
    setCurrentFilter(localFilter);
    setShowFilterPopup(false);
  }

  return (
    <>
      <button
        onClick={() => setShowFilterPopup(!showFilterPopup)}
        style={styles.btn1}
      >
        Filters
      </button>
      {showFilterPopup && (
        <div className="popup" style={styles.popup}>
          <span style={{ margin: "0 5px" }}>Last N Articles</span>
          <input
            type="checkbox"
            checked={localFilter === "lastNArticles"}
            onChange={(e) => setLocalFilter("lastNArticles")}
          />

          <span style={{ margin: "0 5px" }}>Date Range</span>
          <input
            type="checkbox"
            checked={localFilter === "dateRange"}
            onChange={(e) => setLocalFilter("dateRange")}
          />
          <span style={{ margin: "0 5px" }}>Id Range</span>
          <input
            type="checkbox"
            checked={localFilter === "idRange"}
            onChange={(e) => setLocalFilter("idRange")}
          />
          <button onClick={handleApplyBtn} style={styles.btn2}>
            Apply
          </button>
        </div>
      )}
    </>
  );
}
