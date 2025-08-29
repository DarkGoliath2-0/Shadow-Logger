import mongoose from "mongoose";

const statsHistorySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: false }, // optionnel : global ou par user
  periodType: { type: String, enum: ['day', 'month', 'year'], required: true },
  periodValue: { type: String, required: true }, // ex : '2025-07-13' ou '2025-07' ou '2025'
  count: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
statsHistorySchema.index({ guildId: 1, userId: 1, periodType: 1, periodValue: 1 }, { unique: true });

export default mongoose.model("StatsHistory", statsHistorySchema);
