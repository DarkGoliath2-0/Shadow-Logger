import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  channelId: { type: String },
  messageTemplate: { type: String },
  invitesSynchronized: { type: Boolean, default: false },
});

export default mongoose.model("Config", configSchema);
