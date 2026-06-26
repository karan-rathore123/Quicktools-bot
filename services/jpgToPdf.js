const ILovePDFFile = require("@ilovepdf/ilovepdf-nodejs/ILovePDFFile");
const instance = require("./ilovepdf");

async function jpgToPdf(inputPath) {
  const task = instance.newTask("imagepdf");

  await task.start();

  const file = new ILovePDFFile(inputPath);

  await task.addFile(file);
  await task.process();

  return task.download();
}

module.exports = jpgToPdf;
