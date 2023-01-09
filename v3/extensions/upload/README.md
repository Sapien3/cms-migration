Changes:
developing a solution to prevent users from uploading anything but a pdf file

Files affected:
in controller, Upload.js file, upload function.

```
//if file type is different than pdf, throw an error
if (checkForPdf && files.type !== "application/pdf") {
    throw strapi.errors.badRequest(null, {
    errors: [{ id: "Upload.status.notPdf", message: "File is not a PDF" }],
    });
}
```

in admin/src/containers/InputModalStepperProvider/index.js

```
import { pdfOnly, setPdfOnlyValue } from "../../utils/shouldCheckForPdf";
formData.append("pdfOnly", pdfOnly);
let errorMessageFallback = get(
            err,
            ["response", "payload", "message", "0", "messages", "0", "message"],
            get(err, ["response", "payload", "message"], statusText)
          );

          const errorMessage = get(
            err,
            ["response", "payload", "data", "errors", "0", "message"],
            errorMessageFallback
          );
```

in admin\src\components\InputMedia\index.js

```
import { setPdfOnlyValue } from "../../utils/shouldCheckForPdf";
useEffect(() => {
    setPdfOnlyValue(props.contentTypeUID);
  }, []);
```

-added the file shouldCheckForPdf in utils, as a store of value for communication between components.

Note: to add more modals so they can only accept pdf uploads, go to utils/shouldCheckForPdf.js and add the modal name to the first array.
