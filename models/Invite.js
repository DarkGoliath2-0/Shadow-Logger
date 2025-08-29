import mongoose from "mongoose";

const inviteSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  inviterId: { type: String, required: true },
  uses: { type: Number, default: 0 },
  guildId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Invite", inviteSchema);
