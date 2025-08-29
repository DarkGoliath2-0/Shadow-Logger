import mongoose from "mongoose";

const inviteCounterSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  count: { type: Number, default: 0 },
  tag: { type: String } // Ajout du tag utilisateur (user.tag),
});

inviteCounterSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export default mongoose.model("InviteCounter", inviteCounterSchema);
