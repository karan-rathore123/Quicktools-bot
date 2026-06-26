require("dotenv").config();

const express = require("express");
const app = express();
const { Telegraf } = require("telegraf");
const axios = require("axios");
const fs = require("fs");
const bot = new Telegraf(process.env.BOT_TOKEN);
const FormData = require("form-data");
const userFiles = {};
const mergePdf = require("./services/mergePdf");
const wordToPdf = require("./services/wordToPdf");
const jpgToPdf = require("./services/jpgToPdf");
const startReminderCron = require("./cron/reminderCron");

if (!fs.existsSync("temp")) {
  fs.mkdirSync("temp");
}

function sendWelcomeMessage(ctx) {
  const firstName = ctx.from?.first_name || "there";

  return ctx.reply(
    `👋 Hello ${firstName}!

Welcome to QuickTools 🚀
Your all-in-one file utility bot.

✨ Available Features:
🗜 Compress PDF
🔗 Merge Multiple PDFs
📄 Convert Word → PDF
🖼 Convert JPG/PNG → PDF

📖 How to use:
1. Send a file to this chat.
2. Choose the action from the buttons.
3. Wait a few seconds.
4. Download your processed file.

Examples:
📄 Send a PDF → Compress or Merge
📄 Send a DOCX → Convert to PDF
🖼 Send an Image → Convert to PDF

More tools and a Reminder Mini App are coming soon! 🎉`,
  );
}

bot.start(sendWelcomeMessage);

bot.command("help", sendWelcomeMessage);

bot.on("document", async (ctx) => {
  const file = ctx.message.document;
  const userId = ctx.from.id;

  if (!userFiles[userId]) {
    userFiles[userId] = [];
  }

  userFiles[userId].push(file.file_id);

  console.log(userFiles);

  console.log(file);

  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
  ];

  if (!allowedTypes.includes(file.mime_type)) {
    return ctx.reply("❌ Please send a PDF, DOCX, JPG or PNG file.");
  }

  if (file.mime_type === "application/pdf") {
    await ctx.reply(`📄 ${userFiles[userId].length} PDF(s) uploaded.`);
    await ctx.reply("Choose an action:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗜 Compress PDF", callback_data: "compress" }],
          [{ text: "🔗 Merge PDF", callback_data: "merge" }],
        ],
      },
    });
  } else if (
    file.mime_type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    await ctx.reply("📄 Word file uploaded.");
    await ctx.reply("Choose an action:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📄 Word → PDF", callback_data: "word_to_pdf" }],
        ],
      },
    });
  } else if (
    file.mime_type === "image/jpeg" ||
    file.mime_type === "image/png"
  ) {
    await ctx.reply("🖼 Image uploaded.");
    await ctx.reply("Choose an action:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🖼 JPG → PDF", callback_data: "jpg_to_pdf" }],
        ],
      },
    });
  }
});

bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;

  // Telegram sends multiple sizes, pick the largest
  const photo = ctx.message.photo.pop();

  userFiles[userId] = [photo.file_id];

  await ctx.reply("🖼 Image uploaded.");
  await ctx.reply("Choose an action:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🖼 JPG → PDF",
            callback_data: "jpg_to_pdf",
          },
        ],
      ],
    },
  });
});

bot.action("compress", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;
  if (!userFiles[userId] || userFiles[userId].length === 0) {
    return ctx.reply("❌ Please upload a PDF first.");
  }

  const fileId = userFiles[userId][0];

  const inputPath = `temp/${userId}_input.pdf`;
  const outputPath = `temp/${userId}_compressed.pdf`;

  try {
    const processingMsg = await ctx.reply("⏳ Compressing PDF...");

    // Get Telegram file URL
    const fileLink = await ctx.telegram.getFileLink(fileId);

    // Download PDF
    const response = await axios({
      url: fileLink.href,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(inputPath);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // Send PDF to backend
    const formData = new FormData();

    formData.append("pdf", fs.createReadStream(inputPath));

    const compressedResponse = await axios.post(
      `${process.env.BACKEND_URL}/compress`,
      formData,
      {
        headers: formData.getHeaders(),
        responseType: "arraybuffer",
      },
    );

    // Save compressed PDF
    fs.writeFileSync(outputPath, compressedResponse.data);

    // Send compressed PDF to user
    await ctx.replyWithDocument({
      source: outputPath,
      filename: "compressed.pdf",
    });

    // Delete processing message
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    } catch (err) {
      console.log("Could not delete processing message");
    }

    // Delete temp files
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // Remove stored file ID
    delete userFiles[userId];
  } catch (error) {
    console.error(error);

    await ctx.reply("❌ Compression failed. Please try again.");
  }
});

bot.action("merge", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;

  if (!userFiles[userId] || userFiles[userId].length < 2) {
    return ctx.reply("❌ Upload at least 2 PDFs to merge.");
  }

  const processingMsg = await ctx.reply("⏳ Merging PDFs...");

  try {
    const filePaths = [];

    for (let i = 0; i < userFiles[userId].length; i++) {
      const fileId = userFiles[userId][i];

      const fileLink = await ctx.telegram.getFileLink(fileId);

      const response = await axios({
        url: fileLink.href,
        method: "GET",
        responseType: "stream",
      });

      const inputPath = `temp/${userId}_${i}.pdf`;

      const writer = fs.createWriteStream(inputPath);

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      filePaths.push(inputPath);
    }

    const mergedPdf = await mergePdf(filePaths);

    const outputPath = `temp/${userId}_merged.pdf`;

    fs.writeFileSync(outputPath, mergedPdf);

    await ctx.replyWithDocument({
      source: outputPath,
      filename: "merged.pdf",
    });

    // Cleanup
    for (const path of filePaths) {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    }

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    delete userFiles[userId];

    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    } catch (err) {}
  } catch (error) {
    console.error(error);

    await ctx.reply("❌ Merge failed.");
  }
});

bot.action("word_to_pdf", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;
  if (!userFiles[userId] || userFiles[userId].length === 0) {
    return ctx.reply("❌ Upload a DOCX file first.");
  }

  const fileId = userFiles[userId][0];

  const inputPath = `temp/${userId}.docx`;
  const outputPath = `temp/${userId}.pdf`;

  try {
    const processingMsg = await ctx.reply("⏳ Converting Word to PDF...");

    const fileLink = await ctx.telegram.getFileLink(fileId);

    const response = await axios({
      url: fileLink.href,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(inputPath);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const pdfData = await wordToPdf(inputPath);

    fs.writeFileSync(outputPath, pdfData);

    await ctx.replyWithDocument({
      source: outputPath,
      filename: "converted.pdf",
    });

    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    delete userFiles[userId];

    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    } catch {}
  } catch (error) {
    console.error(error);

    await ctx.reply("❌ Conversion failed.");
  }
});

bot.action("jpg_to_pdf", async (ctx) => {
  await ctx.answerCbQuery();

  const userId = ctx.from.id;

  if (!userFiles[userId] || userFiles[userId].length === 0) {
    return ctx.reply("❌ Upload an image first.");
  }

  const fileId = userFiles[userId][0];

  const inputPath = `temp/${userId}.jpg`;
  const outputPath = `temp/${userId}.pdf`;

  try {
    const processingMsg = await ctx.reply("⏳ Converting image to PDF...");

    const fileLink = await ctx.telegram.getFileLink(fileId);

    const response = await axios({
      url: fileLink.href,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(inputPath);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const pdfData = await jpgToPdf(inputPath);

    fs.writeFileSync(outputPath, pdfData);

    await ctx.replyWithDocument({
      source: outputPath,
      filename: "converted.pdf",
    });

    // Cleanup
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    delete userFiles[userId];

    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    } catch {}
  } catch (error) {
    console.error(error);

    await ctx.reply("❌ JPG to PDF conversion failed.");
  }
});

app.get("/", (req, res) => {
  res.send("QuickTools Bot is running 🚀");
});

bot.command("myid", (ctx) => {
  console.log(ctx.from);

  ctx.reply(`Your Telegram ID is ${ctx.from.id}`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

bot.launch();

startReminderCron(bot);
console.log("Bot Started");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
