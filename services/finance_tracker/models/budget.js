const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  currentAmount: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  category: { type: String, default: 'General' },
  recurrence: { type: String, enum: ['one-time','monthly','weekly','yearly'], default: 'monthly' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  notes: { type: String },
  recommendedAllocation: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

BudgetSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Budget', BudgetSchema);
