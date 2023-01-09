import React from "react";

export default function Table({ rowsData }) {
  const styles = {
    btn: {
      border: "1px black solid",
      marginLeft: "10px",
      padding: "2px 5px",
      backgroundColor: "#eee",
    },
  };
  return (
    <table>
      <thead>
        <tr>
          <th>Author</th>
          <th>Number of Articles</th>
          <th>Articles Headline</th>
          <th>Preview Author in collection type</th>
          {/* <th>メールアドレス</th> */}
        </tr>
      </thead>
      <tbody>
        {rowsData.map((row, index) => {
          return (
            <tr key={index}>
              <td>{row.author}</td>
              <td>{row.numberOfArticles}</td>
              <td>
                <select>
                  {row.headlines.map((headline, index) => {
                    return <option key={index}>{headline}</option>;
                  })}
                </select>
              </td>
              <td>
                <button
                  style={styles.btn}
                  onClick={() => window.open(row.link, "_blank")}
                >
                  open
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
