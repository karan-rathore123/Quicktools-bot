require("dotenv").config();

const ILovePDFApi = require("@ilovepdf/ilovepdf-nodejs");

console.log("===== iLovePDF ENV CHECK =====");
console.log("PUBLIC_KEY =", process.env.PUBLIC_KEY);
console.log(
  "SECRET_KEY length =",
  process.env.SECRET_KEY?.length
);
console.log("==============================");

const instance = new ILovePDFApi(
  process.env.PUBLIC_KEY,
  process.env.SECRET_KEY,
);

module.exports = instance;
