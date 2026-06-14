const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

async function mergePdf(filePaths) {
  const formData = new FormData();

  for (const filePath of filePaths) {
    formData.append("pdfs", fs.createReadStream(filePath));
  }

  const response = await axios.post(
    `${process.env.BACKEND_URL}/merge`,
    formData,
    {
      headers: formData.getHeaders(),
      responseType: "arraybuffer",
    }
  );

  return response.data;
}

module.exports = mergePdf;