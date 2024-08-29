const cron = require("node-cron");
const ShareController = require("../controllers/ShareController");
const PropertyController = require("../controllers/PropertyController");

const startCronJobs = () => {
  cron.schedule("0 0 * * *", ShareController.handleShareReservation);
  cron.schedule("0 0 * * *", PropertyController.handleDraftProperties);
  cron.schedule("0 0 * * *", PropertyController.openInspections);
  cron.schedule("0 0 * * *", PropertyController.calPropertyDurationCompletion);
};

module.exports = startCronJobs;
