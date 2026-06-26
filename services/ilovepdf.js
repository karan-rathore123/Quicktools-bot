require("dotenv").config();

const ILovePDFApi = require("@ilovepdf/ilovepdf-nodejs");

const instance = new ILovePDFApi(
  process.env.PUBLIC_KEY,
  process.env.SECRET_KEY,
);

module.exports = instance;
