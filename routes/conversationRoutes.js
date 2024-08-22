const express = require("express");
const router = express.Router();
const ConversationController = require("../controllers/conversationsController");

//POST
router.post("/gen-conversation", ConversationController.genConversation);
router.post("/add-new-message", ConversationController.addNewMessage);

//PUT
router.put(
  "/update-message-actions",
  ConversationController.handleMessageActions
);

//GET
router.get(
  "/get-conversations-by-username/:username",
  ConversationController.getConversationsByUser
);
router.get(
  "/get-conversation-by-id/:id/:username",
  ConversationController.getConversationByID
);

module.exports = router;
