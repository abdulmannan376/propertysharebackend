const cron = require("node-cron");
const ShareController = require("../controllers/ShareController");
const PropertyController = require("../controllers/PropertyController");
const PaymentController = require("../controllers/PaymentController")

const startCronJobs = () => {
  cron.schedule("0 0 * * *", ShareController.handleShareReservation);
  cron.schedule("0 0 * * *", PropertyController.handleDraftProperties);
  cron.schedule("0 0 * * *", PropertyController.openInspections);
  cron.schedule("0 0 * * *", PropertyController.calPropertyDurationCompletion);
  cron.schedule("0 * * * *", PaymentController.handlePendingOfferPayments);
  cron.schedule("0 0 * * *", PropertyController.featuredExpiry);
};

module.exports = startCronJobs;
