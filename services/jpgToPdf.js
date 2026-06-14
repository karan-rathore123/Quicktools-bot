const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

async function jpgToPdf(inputPath) {
  const formData = new FormData();

  formData.append("image", fs.createReadStream(inputPath));

  const response = await axios.post(
    `${process.env.BACKEND_URL}/jpg-to-pdf`,
    formData,
    {
      headers: formData.getHeaders(),
      responseType: "arraybuffer",
    }
  );

  return response.data;
}

module.exports = jpgToPdf;