require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const { Order, OrderItem, Product } = require('./models/associations');
const expressLayouts = require('express-ejs-layouts');
const Setting = require('./models/Setting');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(expressLayouts);
app.set('layout', 'layout');

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false });

app.use(session({
  store: new pgSession({ pool: pgPool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// Модели и ассоциации
const { sequelize } = require('./models');
const { Category } = require('./models/associations');
require('./models/associations');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const upload = multer({ storage: multer.memoryStorage() });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@apteka.ru';

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    console.log('USER FROM DB:', user && user.toJSON ? user.toJSON() : user);
    done(null, user);
  } catch (e) {
    done(e);
  }
});

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return done(null, false, { message: 'Пользователь не найден' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return done(null, false, { message: 'Неверный пароль' });
    return done(null, user);
  } catch (e) {
    return done(e);
  }
}));

// Middleware для передачи user и isAdmin во все шаблоны
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.isAdmin = req.user && req.user.is_admin;
  res.locals.success = undefined;
  res.locals.info = undefined;
  console.log('isAdmin:', res.locals.isAdmin, 'user:', req.user && req.user.email);
  next();
});

// Главная страница: баннер, категории, товары со скидкой
app.get('/', async (req, res) => {
  const categories = await Category.findAll();
  const discounted = await Product.findAll({ where: { is_discounted: true, is_hidden: false }, limit: 6 });
  const discountImage = await Setting.findOne({ where: { key: 'discount_category_image' } });
  res.render('index', {
    title: 'Главная',
    categories,
    discounted,
    discountImage: discountImage ? discountImage.value : null
  });
});

// Страница контактов
app.get('/contacts', (req, res) => {
  res.render('contacts', { title: 'Контакты' });
});

// Политика конфиденциальности
app.get('/privacy', (req, res) => {
  res.render('privacy', { title: 'Политика конфиденциальности' });
});

// Пользовательское соглашение
app.get('/terms', (req, res) => {
  res.render('terms', { title: 'Пользовательское соглашение' });
});

// Каталог: все товары, фильтрация по категории, сортировка
app.get('/catalog', async (req, res) => {
  const categories = await Category.findAll();
  const { category, sort, discount } = req.query;
  const where = { is_hidden: false };
  if (category) where.category_id = category;
  if (discount) where.is_discounted = true;
  let order = [['name', 'ASC']];
  if (sort === 'price_asc') order = [['price', 'ASC']];
  if (sort === 'price_desc') order = [['price', 'DESC']];
  if (sort === 'popular') order = [['id', 'DESC']]; // временно по id
  const products = await Product.findAll({ where, order });
  res.render('catalog', {
    title: 'Каталог',
    categories,
    products,
    selectedCategory: category,
    sort,
    discount: !!discount
  });
});

// Страница товара
app.get('/product/:id', async (req, res) => {
  const product = await Product.findByPk(req.params.id, { include: ['Category'] });
  if (!product || product.is_hidden) {
    return res.status(404).render('error', { title: 'Товар не найден', message: 'Товар не найден или скрыт.' });
  }
  res.render('product', { title: product.name, product });
});

// Добавить товар в корзину (POST)
app.post('/cart/add', async (req, res) => {
  const { product_id } = req.body;
  if (!req.session.cart) req.session.cart = [];
  const idx = req.session.cart.findIndex(item => item.product_id == product_id);
  if (idx > -1) {
    req.session.cart[idx].quantity += 1;
  } else {
    req.session.cart.push({ product_id: Number(product_id), quantity: 1 });
  }
  res.redirect('/cart');
});

// Страница корзины
app.get('/cart', async (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.render('cart', { title: 'Корзина', items: [], total: 0 });
  const ids = cart.map(i => i.product_id);
  const products = await Product.findAll({ where: { id: ids } });
  const items = cart.map(item => {
    const product = products.find(p => p.id === item.product_id);
    return product ? { ...item, product } : null;
  }).filter(Boolean);
  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  res.render('cart', { title: 'Корзина', items, total });
});

// Удалить товар из корзины
app.post('/cart/remove', (req, res) => {
  const { product_id } = req.body;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(item => item.product_id != product_id);
  }
  res.redirect('/cart');
});

// Обновить количество товара в корзине
app.post('/cart/update', (req, res) => {
  const { product_id, quantity } = req.body;
  if (req.session.cart) {
    const idx = req.session.cart.findIndex(item => item.product_id === Number(product_id));
    if (idx > -1) {
      req.session.cart[idx].quantity = Math.max(1, Math.min(99, parseInt(quantity) || 1));
    }
  }
  res.redirect('/cart');
});

// Страница оформления заказа
app.get('/order', async (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/cart');
  const ids = cart.map(i => i.product_id);
  const products = await Product.findAll({ where: { id: ids } });
  const items = cart.map(item => {
    const product = products.find(p => p.id === item.product_id);
    return product ? { ...item, product } : null;
  }).filter(Boolean);
  const needPrescription = items.some(i => i.product.requires_prescription);
  res.render('order', { title: 'Оформление заказа', items, needPrescription, error: null });
});

// Оформление заказа (POST)
app.post('/order', upload.single('prescription'), async (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/cart');
  const ids = cart.map(i => i.product_id);
  const products = await Product.findAll({ where: { id: ids } });
  const items = cart.map(item => {
    const product = products.find(p => p.id === item.product_id);
    return product ? { ...item, product } : null;
  }).filter(Boolean);
  const needPrescription = items.some(i => i.product.requires_prescription);
  const { phone, address } = req.body;
  // Валидация телефона и адреса
  if (!phone || !/^\+7\d{10}$/.test(phone)) {
    return res.render('order', { title: 'Оформление заказа', items, needPrescription, error: 'Введите корректный телефон в формате +7XXXXXXXXXX' });
  }
  if (!address || address.length < 5) {
    return res.render('order', { title: 'Оформление заказа', items, needPrescription, error: 'Введите корректный адрес доставки' });
  }
  let prescriptionUrl = null;
  if (needPrescription) {
    if (!req.file) {
      return res.render('order', { title: 'Оформление заказа', items, needPrescription, error: 'Загрузите фото рецепта!' });
    }
    prescriptionUrl = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'aptekaru/recipes' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      stream.end(req.file.buffer);
    });
  }
  // Сохраняем заказ
  const order = await Order.create({
    user_id: req.user ? req.user.id : null,
    prescription_url: prescriptionUrl,
    status: 'pending',
    phone,
    address
  });
  for (const item of items) {
    let finalPrice = item.product.price;
    let oldPrice = null;
    let discountPercent = 0;
    if (item.product.is_discounted && item.product.discount_percent > 0) {
      oldPrice = item.product.price;
      discountPercent = item.product.discount_percent;
      finalPrice = (item.product.price * (1 - item.product.discount_percent / 100));
    }
    await OrderItem.create({
      order_id: order.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price: finalPrice,
      old_price: oldPrice,
      discount_percent: discountPercent
    });
  }
  req.session.cart = [];
  res.render('order-success', { title: 'Заказ оформлен', order });
});

// Регистрация
app.get('/register', (req, res) => {
  res.render('register', { title: 'Регистрация', error: null });
});
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.render('register', { title: 'Регистрация', error: 'Заполните все поля' });
  if (password.length < 6 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return res.render('register', { title: 'Регистрация', error: 'Пароль должен быть не менее 6 символов, содержать буквы и цифры' });
  }
  const exists = await User.findOne({ where: { email } });
  if (exists) return res.render('register', { title: 'Регистрация', error: 'Email уже зарегистрирован' });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password_hash: hash });
  req.login(user, err => {
    if (err) return res.render('register', { title: 'Регистрация', error: 'Ошибка входа' });
    res.redirect('/profile');
  });
});

// Вход
app.get('/login', (req, res) => {
  res.render('login', { title: 'Вход', error: null, query: req.query });
});
app.post('/login', passport.authenticate('local', {
  successRedirect: '/profile',
  failureRedirect: '/login?error=1'
}));

// Выход
app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Профиль пользователя
app.get('/profile', ensureAuth, async (req, res) => {
  const orders = await Order.findAll({
    where: { user_id: req.user.id },
    order: [['created_at', 'DESC']],
    include: [{ model: OrderItem, include: [Product] }]
  });
  res.render('profile', { title: 'Профиль', user: req.user, orders });
});

// Редактирование профиля (POST)
app.post('/profile/edit', ensureAuth, async (req, res) => {
  const { name, phone, address, password } = req.body;
  let error = null;
  if (!name || name.length < 2) error = 'Введите имя';
  if (!phone || !/^\+7\d{10}$/.test(phone)) error = 'Введите корректный телефон в формате +7XXXXXXXXXX';
  if (!address || address.length < 5) error = 'Введите корректный адрес';
  if (password && password.length > 0 && (password.length < 6 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) error = 'Пароль должен быть не менее 6 символов, содержать буквы и цифры';
  if (error) {
    const orders = await Order.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      include: [{ model: OrderItem, include: [Product] }]
    });
    return res.render('profile', { title: 'Профиль', user: { ...req.user.toJSON(), name, phone, address }, orders, error });
  }
  await req.user.update({ name, phone, address });
  if (password && password.length >= 6) {
    const hash = await bcrypt.hash(password, 10);
    await req.user.update({ password_hash: hash });
  }
  res.redirect('/profile');
});

function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.is_admin) return next();
  res.redirect('/login');
}

// Админка — список товаров
app.get('/admin', ensureAdmin, async (req, res) => {
  const products = await Product.findAll({ include: [Category], order: [['id', 'DESC']] });
  res.render('admin/index', { title: 'Админка', products });
});

// Админка — добавить товар (форма)
app.get('/admin/products/new', ensureAdmin, async (req, res) => {
  const categories = await Category.findAll();
  res.render('admin/product-form', { title: 'Добавить товар', product: null, categories, error: null });
});

// Админка — добавить товар (POST)
app.post('/admin/products/new', ensureAdmin, upload.single('image'), async (req, res) => {
  const { name, price, description, category_id, is_discounted, requires_prescription, discount_percent } = req.body;
  if (!name || !price || !category_id) {
    const categories = await Category.findAll();
    return res.render('admin/product-form', { title: 'Добавить товар', product: null, categories, error: 'Заполните все обязательные поля' });
  }
  let image_url = null;
  if (req.file) {
    image_url = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'aptekaru/products' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      stream.end(req.file.buffer);
    });
  }
  await Product.create({
    name,
    price,
    description,
    image_url,
    category_id,
    is_discounted: !!is_discounted,
    requires_prescription: !!requires_prescription,
    discount_percent: !!is_discounted && discount_percent ? parseInt(discount_percent) : 0
  });
  res.redirect('/admin');
});

// Админка — редактировать товар (форма)
app.get('/admin/products/:id/edit', ensureAdmin, async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  const categories = await Category.findAll();
  if (!product) return res.redirect('/admin');
  res.render('admin/product-form', { title: 'Редактировать товар', product, categories, error: null });
});

// Админка — редактировать товар (POST)
app.post('/admin/products/:id/edit', ensureAdmin, upload.single('image'), async (req, res) => {
  const { name, price, description, category_id, is_discounted, requires_prescription, discount_percent } = req.body;
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.redirect('/admin');
  let image_url = product.image_url;
  if (req.file) {
    image_url = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'aptekaru/products' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      stream.end(req.file.buffer);
    });
  }
  await product.update({
    name,
    price,
    description,
    image_url,
    category_id,
    is_discounted: !!is_discounted,
    requires_prescription: !!requires_prescription,
    discount_percent: !!is_discounted && discount_percent ? parseInt(discount_percent) : 0
  });
  res.redirect('/admin');
});

// Админка — скрыть/показать товар
app.post('/admin/products/:id/toggle', ensureAdmin, async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (product) await product.update({ is_hidden: !product.is_hidden });
  res.redirect('/admin');
});

// Админка — список категорий
app.get('/admin/categories', ensureAdmin, async (req, res) => {
  const categories = await Category.findAll({ order: [['name', 'ASC']] });
  res.render('admin/categories', { title: 'Категории', categories, error: null });
});

// Админка — добавить категорию
app.post('/admin/categories/new', ensureAdmin, upload.single('image'), async (req, res) => {
  const { name } = req.body;
  if (!name) {
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    return res.render('admin/categories', { title: 'Категории', categories, error: 'Введите название категории' });
  }
  let image_url = null;
  if (req.file) {
    image_url = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'aptekaru/categories' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      stream.end(req.file.buffer);
    });
  }
  await Category.create({ name, image_url });
  res.redirect('/admin/categories');
});

// Админка — редактировать категорию
app.post('/admin/categories/:id/edit', ensureAdmin, upload.single('image'), async (req, res) => {
  const { name } = req.body;
  const category = await Category.findByPk(req.params.id);
  if (!category) return res.redirect('/admin/categories');
  let image_url = category.image_url;
  if (req.file) {
    image_url = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'aptekaru/categories' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      stream.end(req.file.buffer);
    });
  }
  await category.update({ name, image_url });
  res.redirect('/admin/categories');
});

// Админка — удалить категорию (только если нет товаров)
app.post('/admin/categories/:id/delete', ensureAdmin, async (req, res) => {
  const category = await Category.findByPk(req.params.id);
  if (!category) return res.redirect('/admin/categories');
  const products = await Product.findAll({ where: { category_id: category.id } });
  if (products.length === 0) await category.destroy();
  res.redirect('/admin/categories');
});

// Админка — список заказов
app.get('/admin/orders', ensureAdmin, async (req, res) => {
  const orders = await Order.findAll({
    order: [['created_at', 'DESC']],
    include: [
      { model: User },
      { model: OrderItem, include: [Product] }
    ]
  });
  res.render('admin/orders', { title: 'Заказы', orders });
});

// Админка — смена статуса заказа
app.post('/admin/orders/:id/status', ensureAdmin, async (req, res) => {
  const { status } = req.body;
  const order = await Order.findByPk(req.params.id);
  if (order && status) {
    await order.update({ status });
  }
  res.redirect('/admin/orders');
});

// Админка — редактировать категорию скидок
app.post('/admin/categories/discount/edit', ensureAdmin, upload.single('image'), async (req, res) => {
  try {
    if (req.file) {
      const image_url = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'aptekaru/categories' },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }
        );
        stream.end(req.file.buffer);
      });
      // Сохраняем URL изображения в настройках
      await Setting.upsert({ 
        key: 'discount_category_image', 
        value: image_url 
      });
    }
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error updating discount category:', error);
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    res.render('admin/categories', { 
      title: 'Категории', 
      categories, 
      error: 'Ошибка при обновлении изображения категории скидок' 
    });
  }
});

// Запуск сервера и подключение к БД
sequelize.sync().then(() => {
  app.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
  });
}).catch(error => {
  console.error('Ошибка при запуске сервера:', error);
});