const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

async function wordToPdf(inputPath) {
  const formData = new FormData();

  formData.append("file", fs.createReadStream(inputPath));

  const response = await axios.post(
    `${process.env.BACKEND_URL}/word-to-pdf`,
    formData,
    {
      headers: formData.getHeaders(),
      responseType: "arraybuffer",
    }
  );

  return response.data;
}

module.exports = wordToPdf;