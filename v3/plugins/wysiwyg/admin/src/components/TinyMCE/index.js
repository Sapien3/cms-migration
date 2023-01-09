import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { auth } from "strapi-helper-plugin";

import "tinymce/tinymce";

import "tinymce/icons/default";
import "tinymce/themes/silver";
import "tinymce/plugins/paste";
import "tinymce/plugins/link";
import "tinymce/plugins/image";
import "tinymce/plugins/table";
import "tinymce/plugins/hr";
import "tinymce/plugins/code";
import "tinymce/plugins/advlist";

import "tinymce/plugins/insertdatetime";
import "tinymce/plugins/charmap";
import "tinymce/plugins/lists";
import "tinymce/plugins/autolink";
import "tinymce/plugins/print";
import "tinymce/plugins/preview";
import "tinymce/plugins/anchor";
import "tinymce/plugins/spellchecker";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/visualblocks";
import "tinymce/plugins/fullscreen";
import "tinymce/plugins/media";
import "tinymce/plugins/codesample";
import "tinymce/plugins/visualchars";
import "tinymce/plugins/imagetools";
import "tinymce/plugins/emoticons";
import "tinymce/plugins/emoticons/js/emojis";
import "tinymce/plugins/emoticons/js/emojiimages";
import "tinymce/plugins/wordcount";
import "tinymce/plugins/help";

import "./langs/ar";
import "./plugins/instagram";

import "tinymce/skins/ui/oxide/skin.min.css";
import "tinymce/skins/ui/oxide/content.min.css";
import "tinymce/skins/content/default/content.min.css";

import { Editor as Tinymce } from "@tinymce/tinymce-react";

const Wrapper = styled.div`
  .ck-editor__main {
    min-height: 200px;
    > div {
      min-height: 200px;
    }
  }
`;

function example_image_upload_handler(blobInfo, success, failure, progress) {
  //using the fetch API
  const url = "/upload";
  const formData = new FormData();
  formData.append("files", blobInfo.blob(), blobInfo.filename());

  fetch(url, {
    method: "POST",
    ContentType: "multipart/form-data",
    body: formData,
  })
    .then((response) => response.json())
    .then((result) => {
      console.log("Success:", result);
      success(result[0].url);
    })
    .catch((error) => {
      console.error("Error:", error);
      failure("HTTP Error: " + error);
    });
}

const Editor = ({ onChange, name, value }) => {
  const jwtToken = auth.getToken();
  return (
    <>
      <Wrapper>
        <Tinymce
          apiKey="2b7qg9scnwaj60xf0p2gxjb9vlkkm96x8ow6ywcktkqcs0qz"
          value={value}
          init={{
            height: 500,
            language: strapi.currentLanguage,
            menubar: true,
            image_advtab: true,
            skin: false,
            // eslint-disable-next-line @typescript-eslint/camelcase
            convert_urls: false,
            relative_urls: true,
            remove_script_host: true,
            image_caption: true,
            toolbar_mode: "wrap",
            theme: "silver",
            plugins: [
              "advlist autolink lists link image charmap print preview anchor spellchecker",
              "searchreplace visualblocks code fullscreen ",
              "insertdatetime media table paste code help wordcount",
              "media codesample fullscreen",
              "instagram",
              "hr visualchars imagetools emoticons",
            ],
            toolbar:
              // eslint-disable-next-line no-multi-str
              "undo redo  | formatselect forecolor backcolor | \
              bold italic underline strikethrough removeformat | \
              alignleft aligncenter alignright alignjustify | \
              outdent indent | numlist bullist | \
              table link anchor | image media codesample charmap emoticons | \
              fullscreen  code | blockquote instagram | preview print | ",
            image_title: true,
            automatic_uploads: true,
            file_picker_types: "image",
            file_picker_types: "file image media",
            images_upload_credentials: true,
            images_upload_handler: example_image_upload_handler,
            file_picker_callback: function (cb, value, meta) {
              var input = document.createElement("input");
              input.setAttribute("type", "file");
              input.setAttribute("accept", "image/*");
              input.onchange = function () {
                var file = this.files[0];
                var reader = new FileReader();
                reader.onload = function () {
                  var id = "blobid" + new Date().getTime();
                  var blobCache = window.tinymce.activeEditor.editorUpload.blobCache;
                  var base64 = reader.result.split(",")[1];
                  var blobInfo = blobCache.create(id, file, base64);
                  blobCache.add(blobInfo);
                  cb(blobInfo.blobUri(), { title: file.name });
                };
                reader.readAsDataURL(file);
              };
              input.click();
            },
          }}
          onEditorChange={(content, editor) => {
            onChange({ target: { name, value: content } });
          }}
        />
      </Wrapper>
    </>
  );
};

Editor.propTypes = {
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

export default Editor;
