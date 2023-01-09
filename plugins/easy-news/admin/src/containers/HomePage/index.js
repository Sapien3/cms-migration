import React, { useState, useRef, useEffect } from "react";

function MediaUploader({ entryId, easyNewsId, token }) {
  const [message, setMessage] = useState("");
  const spanRef = useRef(null);

  const uplaodMedia = (e) => {
    spanRef.current.style.color = "black";
    setMessage("Uploading image...");
    const url = "/easy-news/upload/media";
    const inputElement = e.target;
    const file = inputElement.files[0];
    const formData = new FormData();
    formData.append("files", file, file.name);
    formData.append("entryId", entryId);

    fetch(url, {
      method: "POST",
      ContentType: "multipart/form-data",
      body: formData,
      headers: {
        Authorization: token,
      },
    })
      .then((response) => response.json())
      .then((result) => {
        setMessage(result.message);
        if (result.error) {
          spanRef.current.style.color = "red";
          inputElement.value = "";
          console.log("Error:", result);
        } else {
          spanRef.current.style.color = "green";
          console.log("Success:", result);
        }
      })
      .catch((err) => {
        console.error(err);
        spanRef.current.style.color = "red";
        setMessage(err.message);
      });
  };

  return (
    <>
      <h1>Upload Image for easy news id of {easyNewsId}</h1>
      <input type="file" name="file" onChange={uplaodMedia} />
      <p className="under-browse">
        <span ref={spanRef}>{message}</span>
      </p>
    </>
  );
}

function HomePage() {
  const [message, setMessage] = useState("");
  const [strapiId, setStrapiId] = useState(null);
  const [easyNewsId, setEasyNewsId] = useState(null);
  const spanRef = useRef(null);
  const token =
    "Bearer " + sessionStorage.getItem("jwtToken").replace(/['"]+/g, "");

  const uploadXml = (e) => {
    spanRef.current.style.color = "black";
    setMessage("Processing...");
    setStrapiId(null);
    const url = "/easy-news/upload/xml";
    const inputElement = e.target;
    const file = inputElement.files[0];
    const formData = new FormData();
    formData.append("files", file, file.name);
    fetch(url, {
      method: "POST",
      ContentType: "multipart/form-data",
      body: formData,
      headers: {
        Authorization: token,
      },
    })
      .then((response) => response.json())
      .then((result) => {
        setMessage(result.message);
        if (result.error) {
          spanRef.current.style.color = "red";
          inputElement.value = "";
          console.log("Error:", result);
        } else {
          setStrapiId(result.entryId);
          spanRef.current.style.color = "green";
          console.log("Success:", result);
          setEasyNewsId(result.payload.newsItem.id[0]);
        }
      })
      .catch((error) => {
        setMessage(error);
        spanRef.current.style.color = "red";
        console.error("Error:", error);
      });
  };

  const handlePreviewClick = () => {
    window.open(
      `/cmsadmin/plugins/content-manager/collectionType/application::easy-news.easy-news/${strapiId}`,
      "_blank"
    );
  };

  return (
    <div style={{ position: "relative", top: "20px", left: "10px" }}>
      <h1>Upload XML File</h1>
      <input type="file" name="file" onChange={uploadXml} />
      <p className="under-browse">
        <span ref={spanRef}>{message}</span>
        {strapiId && (
          <button
            style={{
              border: "1px black solid",
              marginLeft: "10px",
              padding: "5px",
              backgroundColor: "#eee",
            }}
            onClick={handlePreviewClick}
          >
            Preview in collection type
          </button>
        )}
      </p>
      {strapiId && easyNewsId && (
        <MediaUploader
          entryId={strapiId}
          easyNewsId={easyNewsId}
          token={token}
        />
      )}
    </div>
  );
}

export default HomePage;
