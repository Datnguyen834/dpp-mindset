const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mindset_dpp_super_secret_key_2026';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ====================================================
// MIDDLEWARE BẢO VỆ API QUẢN TRỊ (CHỈ ADMIN MỚI GỌI ĐƯỢC)
// ====================================================
function verifyAdminToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Chưa đăng nhập! Vui lòng truy cập /admin/login' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err || user.role !== 'admin') {
            return res.status(403).json({ error: 'Token không hợp lệ hoặc không có quyền Quản trị viên!' });
        }
        req.user = user;
        next();
    });
}

// ====================================================
// 1. API XÁC THỰC QUẢN TRỊ VIÊN
// ====================================================
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '12h' }
        );
        res.json({ message: 'Đăng nhập thành công!', token, username: user.username });
    });
});

app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ loggedIn: false });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ loggedIn: false });
        res.json({ loggedIn: true, username: user.username, role: user.role });
    });
});

// ====================================================
// 2. API CÔNG KHAI (DÀNH CHO KHÁCH QUÉT MÃ QR - KHÔNG CẦN ĐĂNG NHẬP)
// ====================================================
app.get('/api/public/products/:id', (req, res) => {
    const productId = req.params.id;
    db.get(`SELECT * FROM products WHERE id = ?`, [productId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Không tìm thấy Hộ chiếu số cho mã sản phẩm này.' });
        res.json(row);
    });
});

// ====================================================
// 3. API QUẢN TRỊ CRUD SẢN PHẨM (YÊU CẦU TOKEN ADMIN)
// ====================================================

// Lấy danh sách toàn bộ sản phẩm
app.get('/api/admin/products', verifyAdminToken, (req, res) => {
    db.all(`SELECT * FROM products ORDER BY updated_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Thêm sản phẩm mới
app.post('/api/admin/products', verifyAdminToken, (req, res) => {
    const { id, name, tagline, capacity, temperature, weight, material_desc, co2_emission, batch_code, release_date } = req.body;
    if (!id || !name) {
        return res.status(400).json({ error: 'Mã sản phẩm (ID) và Tên sản phẩm là bắt buộc!' });
    }

    const sql = `INSERT INTO products (
        id, name, tagline, capacity, temperature, weight, material_desc, co2_emission, batch_code, release_date, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

    db.run(
        sql,
        [
            id.trim(),
            name.trim(),
            tagline || '',
            capacity || '500ml',
            temperature || '12h nóng / 24h lạnh',
            weight || '320g',
            material_desc || '',
            co2_emission || '1.24 kg',
            batch_code || '#MS-2026-VN08',
            release_date || '15/02/2026'
        ],
        function (err) {
            if (err) {
                return res.status(400).json({ error: 'Mã sản phẩm đã tồn tại hoặc dữ liệu không hợp lệ!' });
            }
            res.json({ message: 'Đã thêm sản phẩm DPP mới thành công!', id });
        }
    );
});

// Cập nhật thông tin sản phẩm
app.put('/api/admin/products/:id', verifyAdminToken, (req, res) => {
    const productId = req.params.id;
    const { name, tagline, capacity, temperature, weight, material_desc, co2_emission, batch_code, release_date } = req.body;

    const sql = `UPDATE products SET
        name = ?, tagline = ?, capacity = ?, temperature = ?, weight = ?,
        material_desc = ?, co2_emission = ?, batch_code = ?, release_date = ?,
        updated_at = datetime('now')
        WHERE id = ?`;

    db.run(
        sql,
        [name, tagline, capacity, temperature, weight, material_desc, co2_emission, batch_code, release_date, productId],
        function (err) {
            if (err) return res.status(400).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Không tìm thấy sản phẩm cần sửa!' });
            res.json({ message: 'Cập nhật Hộ chiếu số thành công!' });
        }
    );
});

// Xóa sản phẩm
app.delete('/api/admin/products/:id', verifyAdminToken, (req, res) => {
    const productId = req.params.id;
    db.run(`DELETE FROM products WHERE id = ?`, [productId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Không tìm thấy sản phẩm cần xóa!' });
        res.json({ message: 'Đã xóa sản phẩm khỏi hệ thống!' });
    });
});

// ====================================================
// 4. PHÂN QUYỀN THEO ĐƯỜNG DẪN (URL ROUTING)
// ====================================================

// Trang chủ tự động chuyển hướng sang trang DPP của sản phẩm mặc định
app.get('/', (req, res) => {
    res.redirect('/dpp/MS-THERMO-500');
});

// Route Công khai khi khách quét mã QR (Tuyệt đối không hiện nút đăng nhập)
app.get('/dpp/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route Đăng nhập dành riêng cho Admin
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Route Bảng điều khiển Quản trị (Thêm / Sửa / Xóa sản phẩm)
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 HỆ THỐNG DPP MINDSET ĐANG CHẠY TẠI CỔNG ${PORT}`);
    console.log(`👉 Link QR Công khai (Khách hàng): http://localhost:${PORT}/dpp/MS-THERMO-500`);
    console.log(`👉 Link Đăng nhập Quản trị:        http://localhost:${PORT}/admin/login`);
    console.log(`👉 Link Quản lý Thêm/Sửa/Xóa:      http://localhost:${PORT}/admin/dashboard`);
    console.log('====================================================');
});
