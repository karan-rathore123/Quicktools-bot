const ILovePDFFile = require("@ilovepdf/ilovepdf-nodejs/ILovePDFFile");
const instance = require("./ilovepdf");

async function mergePdf(filePaths) {
  const task = instance.newTask("merge");

  await task.start();

  for (const filePath of filePaths) {
    const file = new ILovePDFFile(filePath);
    await task.addFile(file);
  }

  await task.process();

  return task.download();
}

module.exports = mergePdf;
