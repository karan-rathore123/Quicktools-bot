const cron = require("node-cron");
const axios = require("axios");

function startReminderCron(bot) {
  cron.schedule("* * * * *", async () => {
    console.log("⏰ Checking reminders...");

    try {
      const response = await axios.get(
        `${process.env.BACKEND_URL}/reminder/pending`
      );

      const reminders = response.data.reminders;

      const now = new Date();

      for (const reminder of reminders) {
        const reminderTime = new Date(reminder.remindAt);

        if (reminderTime <= now) {
          try {
            // Send Telegram message
            await bot.telegram.sendMessage(
              reminder.telegramId,
              `⏰ Reminder\n\n${reminder.text}`
            );

            console.log(
              `Reminder sent to ${reminder.telegramId}`
            );

            // Handle recurring reminders
            if (reminder.recurring) {
              let nextDate = new Date(reminder.remindAt);

              if (reminder.recurrenceType === "daily") {
                nextDate.setDate(nextDate.getDate() + 1);
              } else if (
                reminder.recurrenceType === "weekly"
              ) {
                nextDate.setDate(nextDate.getDate() + 7);
              } else if (
                reminder.recurrenceType === "monthly"
              ) {
                nextDate.setMonth(nextDate.getMonth() + 1);
              }

              await axios.put(
                `${process.env.BACKEND_URL}/reminder/${reminder._id}`,
                {
                  remindAt: nextDate,
                  sent: false,
                }
              );
            } else {
              // Mark one-time reminder as sent
              await axios.patch(
                `${process.env.BACKEND_URL}/reminder/${reminder._id}/sent`
              );
            }
          } catch (err) {
            console.error(
              "Failed sending reminder:",
              err.message
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "Cron error:",
        error.response?.data || error.message
      );
    }
  });
}

module.exports = startReminderCron;