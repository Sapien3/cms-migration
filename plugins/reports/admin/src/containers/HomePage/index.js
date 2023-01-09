import React, { useState } from "react";
import DateRangePicker from "@wojtekmaj/react-daterange-picker";
import "./style.css";
import Alert from "@mui/material/Alert";
import Table from "../../components/Table";
import LastNArticles from "../../components/LastNArticles";
import IdRange from "../../components/IdRange";
import FilterButton from "../../components/FilterButton";
import CircularProgress from "@mui/material/CircularProgress";

const styles = {
  btn: {
    border: "1px black solid",
    marginLeft: "10px",
    padding: "2px 5px",
    backgroundColor: "#eee",
  },
  span: { color: "red", marginLeft: "5px" },
  alert: { fontSize: "16px", marginTop: "10px" },
};

function DateRange({ dateRange, setDateRange }) {
  return (
    <DateRangePicker
      onChange={setDateRange}
      value={dateRange}
      maxDate={new Date()}
    />
  );
}

function getMonthAgoDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date;
}

function formatRowsData(data) {
  return data.map((row) => {
    const { headlines, author, link, numberOfArticles } = row;
    return { headlines, author, link, numberOfArticles };
  });
}

function Homepage() {
  const [dateRange, setDateRange] = useState([getMonthAgoDate(), new Date()]);
  const [lastNArticles, setLastNArticles] = useState(20);
  const [idRange, setIdRange] = useState(["", ""]);
  const [currentFilter, setCurrentFilter] = useState("lastNArticles");
  const [rowsData, setRowsData] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [warning, setWarning] = useState(null);

  const formatedDate = dateRange
    ? [
        dateRange[0].toISOString().split("T")[0],
        dateRange[1].toISOString().split("T")[0],
      ]
    : null;

  function handleRequestClick(e) {
    let dataToSend;
    if (currentFilter === "dateRange") dataToSend = { formatedDate };
    if (currentFilter === "lastNArticles") dataToSend = { lastNArticles };
    if (currentFilter === "idRange") dataToSend = { idRange };
    return dataToSend;
  }

  function resetStates() {
    setRowsData([]);
    setError(null);
    setWarning(null);
  }

  async function requestData() {
    resetStates();
    setIsLoading(true);
    const dataObj = handleRequestClick();
    const url = "/reports/getAuthors";
    const token = sessionStorage.getItem("jwtToken").replace(/['"]+/g, "");
    const json = JSON.stringify(dataObj);
    const response = await fetch(url, {
      method: "POST",
      body: json,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });

    const result = await response.json();
    console.log("result: ", result);

    if (result.warning || result.payload?.warning)
      setWarning(result.warning || result.payload?.warning);

    if (!result.payload || result.error || result.payload.error) {
      setError(result.error || result.payload.error);
      return setIsLoading(false);
    }

    const formatedData = formatRowsData(result.payload);
    setIsLoading(false);
    setRowsData(formatedData);
  }

  return (
    <div className="reports-plugin">
      <FilterButton
        currentFilter={currentFilter}
        setCurrentFilter={setCurrentFilter}
      />
      {currentFilter === "dateRange" && (
        <DateRange dateRange={dateRange} setDateRange={setDateRange} />
      )}
      {currentFilter === "lastNArticles" && (
        <LastNArticles
          lastNArticles={lastNArticles}
          setLastNArticles={setLastNArticles}
        />
      )}
      {currentFilter === "idRange" && (
        <IdRange idRange={idRange} setIdRange={setIdRange} />
      )}

      <button onClick={requestData} style={styles.btn}>
        request Authors
      </button>
      {error && (
        <Alert severity="error" style={styles.alert}>
          {error}
        </Alert>
      )}
      {warning && (
        <Alert severity="warning" style={styles.alert}>
          {warning}
        </Alert>
      )}
      <Table rowsData={rowsData} />
      {isLoading && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "20px",
          }}
        >
          <CircularProgress />
        </div>
      )}
    </div>
  );
}

export default Homepage;
