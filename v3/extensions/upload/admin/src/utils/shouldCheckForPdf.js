const modals = ["application::edition.edition"];
let pdfOnly = false;
const setPdfOnlyValue = (modalName) => {
  if (modals.includes(modalName)) pdfOnly = true;
  else pdfOnly = false;
};

export { setPdfOnlyValue, pdfOnly };
