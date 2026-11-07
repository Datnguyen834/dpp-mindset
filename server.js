require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) console.warn('⚠️ Chưa cấu hình JWT_SECRET trong Environment.');

app.use(express.json({ limit: '8mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

function verifyAdminToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập! Vui lòng truy cập /admin/login' });
    jwt.verify(token, JWT_SECRET || 'development-only-change-me', (err, user) => {
        if (err || user.role !== 'admin') return res.status(403).json({ error: 'Token không hợp lệ hoặc không có quyền Quản trị viên!' });
        req.user = user;
        next();
    });
}

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password || '', user.password))) {
            return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
        }
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role },
            JWT_SECRET || 'development-only-change-me', { expiresIn: '12h' });
        res.json({ message: 'Đăng nhập thành công!', token, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Không thể đăng nhập. Vui lòng kiểm tra cấu hình Neon.' });
    }
});

app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ loggedIn: false });
    jwt.verify(token, JWT_SECRET || 'development-only-change-me', (err, user) => {
        if (err) return res.status(403).json({ loggedIn: false });
        res.json({ loggedIn: true, username: user.username, role: user.role });
    });
});

app.get('/api/public/products/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Không tìm thấy Hộ chiếu số cho mã sản phẩm này.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Public product error:', err);
        res.status(500).json({ error: 'Không thể tải dữ liệu sản phẩm.' });
    }
});

app.get('/api/admin/products', verifyAdminToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products ORDER BY updated_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Không thể tải danh sách sản phẩm.' });
    }
});

const productFields = ['name','tagline','capacity','temperature','weight','material_desc','co2_emission','batch_code','release_date','image_data'];
function productValues(body) {
    return [
        body.name?.trim(), body.tagline || '', body.capacity || '500ml',
        body.temperature || '12h nóng / 24h lạnh', body.weight || '320g',
        body.material_desc || '', body.co2_emission || '1.24 kg',
        body.batch_code || '#MS-2026-VN08', body.release_date || '15/02/2026',
        body.image_data || null
    ];
}

app.post('/api/admin/products', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id || !req.body.name) return res.status(400).json({ error: 'Mã sản phẩm (ID) và Tên sản phẩm là bắt buộc!' });
        const vals = [id.trim(), ...productValues(req.body)];
        await db.query(`INSERT INTO products (id, ${productFields.join(', ')}, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`, vals);
        res.json({ message: 'Đã thêm sản phẩm DPP mới thành công!', id });
    } catch (err) {
        console.error('Create product error:', err);
        res.status(400).json({ error: err.code === '23505' ? 'Mã sản phẩm đã tồn tại!' : 'Không thể thêm sản phẩm: ' + err.message });
    }
});

app.put('/api/admin/products/:id', verifyAdminToken, async (req, res) => {
    try {
        const vals = [...productValues(req.body), req.params.id];
        const result = await db.query(`UPDATE products SET
            name=$1, tagline=$2, capacity=$3, temperature=$4, weight=$5,
            material_desc=$6, co2_emission=$7, batch_code=$8, release_date=$9,
            image_data=$10, updated_at=NOW() WHERE id=$11`, vals);
        if (!result.rowCount) return res.status(404).json({ error: 'Không tìm thấy sản phẩm cần sửa!' });
        res.json({ message: 'Cập nhật Hộ chiếu số thành công!' });
    } catch (err) {
        console.error('Update product error:', err);
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/admin/products/:id', verifyAdminToken, async (req, res) => {
    try {
        const result = await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        if (!result.rowCount) return res.status(404).json({ error: 'Không tìm thấy sản phẩm cần xóa!' });
        res.json({ message: 'Đã xóa sản phẩm khỏi hệ thống!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Không thể xóa sản phẩm.' });
    }
});

app.get('/', (req, res) => res.redirect('/dpp/MS-THERMO-500'));
app.get('/dpp/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html')));

db.init().then(() => {
    app.listen(PORT, () => console.log(`🚀 DPP Mindset chạy tại cổng ${PORT} – Neon PostgreSQL đã sẵn sàng.`));
}).catch(err => {
    console.error('❌ Không thể khởi tạo database:', err);
    process.exit(1);
});
