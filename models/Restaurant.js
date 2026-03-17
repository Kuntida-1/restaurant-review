const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  province: String,
  category: String,
  images: [{ type: String }],  // ✅ URL รูปภาพ
  avgRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  ratings: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

