const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

let Restaurant = null;
let User = null;
let useMongoDB = false;
let auth = null;

// ลองเชื่อม MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 10000
}).then(async () => {
  console.log('✅ MongoDB Connected!');
  Restaurant = require('./models/Restaurant');
  User = require('./models/User');
  auth = require('./middleware/auth');
  useMongoDB = true;
  
  const count = await Restaurant.countDocuments();
  if (count === 0) {
    await Restaurant.insertMany([
      { name: "ร้านข้าวมันไก่ป้าแดง", address: "บางพระ ศรีราชา", province: "ชลบุรี", category: "ข้าวมันไก่", avgRating: 4.5, totalReviews: 23 },
      { name: "ก๋วยเตี๊ยวเรือธนบุรี", address: "ศรีราชา", province: "ชลบุรี", category: "ก๋วยเตี๊ยว", avgRating: 4.2, totalReviews: 15 },
      { name: "Starbucks สยาม", address: "สยามสแควร์", province: "กรุงเทพมหานคร", category: "ร้านกาแฟ", avgRating: 4.0, totalReviews: 89 }
    ]);
    console.log('📦 Sample Data Inserted!');
  }
}).catch(err => {
  console.log('⚠️ MongoDB Error - ใช้ Mock Data');
});

const mockData = [
  { _id: "1", name: "ร้านข้าวมันไก่ป้าแดง", address: "บางพระ ศรีราชา", province: "ชลบุรี", category: "ข้าวมันไก่", avgRating: 4.5, totalReviews: 23 },
  { _id: "2", name: "ก๋วยเตี๊ยวเรือธนบุรี", address: "ศรีราชา", province: "ชลบุรี", category: "ก๋วยเตี๊ยว", avgRating: 4.2, totalReviews: 15 },
  { _id: "3", name: "Starbucks สยาม", address: "สยามสแควร์", province: "กรุงเทพมหานคร", category: "ร้านกาแฟ", avgRating: 4.0, totalReviews: 89 }
];

// GET /restaurants - แสดงชื่อผู้ใช้จริง
app.get('/restaurants', async (req, res) => {
  const { province, category, search } = req.query;
  
  if (useMongoDB && Restaurant && User) {
    try {
      let query = {};
      if (province) query.province = province;
      if (category) query.category = category;
      if (search) query.name = { $regex: search, $options: 'i' };
      
      const restaurants = await Restaurant.find(query)
        .populate('ratings.userId', 'username')  // ✅ ดึงชื่อ
        .populate('addedBy', 'username')
        .sort({ avgRating: -1 })
        .limit(20);
      
      res.json(restaurants);  // ✅ ส่งข้อมูล populate แล้ว
    } catch (error) {
      console.log('MongoDB Error - Fallback to Mock');
      return res.json(mockData);
    }
  } else {
    let filtered = mockData;
    if (province) filtered = filtered.filter(r => r.province.includes(province));
    if (category) filtered = filtered.filter(r => r.category.includes(category));
    if (search) filtered = filtered.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    res.json(filtered);
  }
});

// ✅ เพิ่ม API ใหม่ตรงนี้!
app.get('/restaurants/:id', async (req, res) => {
  if (!useMongoDB || !Restaurant) {
    return res.status(404).json({ error: 'ไม่พบข้อมูล' });
  }
  
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .populate('ratings.userId', 'username')
      .populate('addedBy', 'username');
    
    if (!restaurant) {
      return res.status(404).json({ error: 'ไม่พบร้านอาหาร' });
    }
    
    res.json(restaurant);
  } catch (error) {
    res.status(400).json({ error: 'ไม่พบข้อมูล' });
  }
});

// POST /restaurants (โค้ดเดิม)
app.post('/restaurants', async (req, res) => {
  // ... โค้ดเดิม
});

// POST Restaurants (ต้อง Login)
app.post('/restaurants', async (req, res) => {
  if (!useMongoDB || !Restaurant || !User || !auth) {
    return res.status(503).json({ error: 'ระบบยังไม่พร้อม' });
  }
  
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบ' });
    
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'ผู้ใช้ไม่ถูกต้อง' });
    
    const restaurant = new Restaurant({
      ...req.body,
      addedBy: user._id,
      avgRating: 0,
      totalReviews: 0
    });
    
    await restaurant.save();
    res.json(restaurant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// PUT /restaurants/:id - แก้ไขร้าน (เจ้าของเท่านั้น)
app.put('/restaurants/:id', async (req, res) => {
  if (!useMongoDB || !Restaurant || !User) {
    return res.status(503).json({ error: 'ระบบยังไม่พร้อม' });
  }
  
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบ' });
    
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    const restaurant = await Restaurant.findById(req.params.id);
    
    if (!restaurant) return res.status(404).json({ error: 'ไม่พบร้าน' });
    if (restaurant.addedBy.toString() !== decoded.userId.toString()) {
      return res.status(403).json({ error: 'แก้ไขได้เฉพาะร้านของตัวเอง' });
    }
    
    const updated = await Restaurant.findByIdAndUpdate(
      req.params.id, 
      { ...req.body }, 
      { new: true }
    );
    
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /restaurants/:id/rate - ให้ดาว
app.post('/restaurants/:id/rate', async (req, res) => {
  if (!useMongoDB || !Restaurant || !User) {
    return res.status(503).json({ error: 'ระบบยังไม่พร้อม' });
  }
  
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบ' });
    
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    const { rating, comment } = req.body;
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'ดาวต้อง 1-5' });
    }
    
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: 'ไม่พบร้าน' });
    
    // Check ซ้ำ
    const existingRating = restaurant.ratings.find(r => 
      r.userId.toString() === decoded.userId.toString()
    );
    if (existingRating) {
      return res.status(400).json({ error: 'ให้คะแนนร้านนี้แล้ว' });
    }
    
    // เพิ่ม rating ใหม่
    restaurant.ratings.push({ userId: decoded.userId, rating, comment });
    restaurant.totalReviews = restaurant.ratings.length;
    
    // คำนวณ avgRating
    const totalRating = restaurant.ratings.reduce((sum, r) => sum + r.rating, 0);
    restaurant.avgRating = totalRating / restaurant.ratings.length;
    
    await restaurant.save();
    res.json({ 
      message: 'ให้คะแนนสำเร็จ!', 
      avgRating: restaurant.avgRating.toFixed(1),
      totalReviews: restaurant.totalReviews 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// 👤 User Auth APIs (ทำงานแม้ MongoDB Error)
app.post('/register', async (req, res) => {
  if (!useMongoDB || !User) {
    return res.status(503).json({ error: 'ระบบกำลังเริ่มต้น กรุณารอสักครู่' });
  }
  
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Email หรือ Username ซ้ำ' });
    }
    
    const user = new User({ username, email, password });
    await user.save();
    
    const token = require('jsonwebtoken').sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { id: user._id, username: user.username, email: user.email } 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  if (!useMongoDB || !User) {
    return res.status(503).json({ error: 'ระบบกำลังเริ่มต้น กรุณารอสักครู่' });
  }
  
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: 'Email หรือ Password ผิด' });
    }
    
    const token = require('jsonwebtoken').sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { id: user._id, username: user.username, email: user.email } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server Error' });
  }
});

app.get('/profile', async (req, res) => {
  if (!useMongoDB || !User || !auth) {
    return res.status(503).json({ error: 'ระบบกำลังเริ่มต้น' });
  }
  
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'ไม่มี Token' });
    
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(401).json({ error: 'Token ไม่ถูกต้อง' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`✅ เว็บพร้อมใช้งาน 100%!`);
  console.log(`📱 http://localhost:${PORT}/`);
});
