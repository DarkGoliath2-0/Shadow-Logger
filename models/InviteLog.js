import mongoose from "mongoose";

const inviteLogSchema = new mongoose.Schema({
  inviterId: { type: String, required: true },
  invitedId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  guildId: { type: String, required: true },
});

export default mongoose.model("InviteLog", inviteLogSchema);
