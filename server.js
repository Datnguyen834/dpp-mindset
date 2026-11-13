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

app.use(express.json({ limit: '10mb' }));
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

function parseJsonArray(raw, fallback = []) {
    if (Array.isArray(raw)) return raw.length ? raw : fallback;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length ? parsed : fallback;
        } catch (e) {
            return fallback;
        }
    }
    return fallback;
}

function normalizeSpecs(rawSpecs, fallbackObj = {}) {
    const arr = parseJsonArray(rawSpecs, []);
    const cleaned = arr
        .map(item => ({
            label: String(item?.label || '').trim(),
            value: String(item?.value || '').trim()
        }))
        .filter(item => item.label !== '' || item.value !== '');

    if (cleaned.length === 0) {
        if (fallbackObj.capacity) cleaned.push({ label: 'Dung tích', value: String(fallbackObj.capacity).trim() });
        if (fallbackObj.temperature) cleaned.push({ label: 'Giữ nhiệt', value: String(fallbackObj.temperature).trim() });
        if (fallbackObj.weight) cleaned.push({ label: 'Trọng lượng', value: String(fallbackObj.weight).trim() });
    }
    return cleaned.length ? cleaned : db.DEFAULTS.DEFAULT_SPECS;
}

function formatProductRow(row) {
    if (!row) return null;
    return {
        ...row,
        category: row.category || '',
        specs: normalizeSpecs(row.specs, row),
        material_badge: row.material_badge || 'Inox 304',
        materials: parseJsonArray(row.materials, db.DEFAULTS.DEFAULT_MATERIALS),
        cert_desc: row.cert_desc || 'Đạt các tiêu chuẩn chất lượng và an toàn quốc tế.',
        certifications: parseJsonArray(row.certifications, db.DEFAULTS.DEFAULT_CERTIFICATIONS),
        impact_desc: row.impact_desc || 'Giảm phát thải CO₂ ≈ 32% so với sản phẩm truyền thống.',
        impact_comparison: row.impact_comparison || 'Giảm 32% so với bình giữ nhiệt thông thường (1.82 kg)',
        impact_breakdown: parseJsonArray(row.impact_breakdown, db.DEFAULTS.DEFAULT_IMPACT_BREAKDOWN),
        lifecycle_desc: row.lifecycle_desc || 'Từ nguyên liệu đến tái chế, Mindset luôn đồng hành cùng bạn trong hành trình xanh.',
        lifecycle_stages: parseJsonArray(row.lifecycle_stages, db.DEFAULTS.DEFAULT_LIFECYCLE),
        care_guidelines: parseJsonArray(row.care_guidelines, db.DEFAULTS.DEFAULT_GUIDELINES)
    };
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

app.get('/api/public/products/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Không tìm thấy Hộ chiếu số cho mã sản phẩm này.' });
        res.json(formatProductRow(result.rows[0]));
    } catch (err) {
        console.error('Public product error:', err);
        res.status(500).json({ error: 'Không thể tải dữ liệu sản phẩm.' });
    }
});

app.get('/api/admin/products', verifyAdminToken, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products ORDER BY updated_at DESC');
        res.json(result.rows.map(formatProductRow));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Không thể tải danh sách sản phẩm.' });
    }
});

function extractProductPayload(body) {
    const specs = normalizeSpecs(body.specs, body);
    const materials = parseJsonArray(body.materials, db.DEFAULTS.DEFAULT_MATERIALS);
    const certifications = parseJsonArray(body.certifications, db.DEFAULTS.DEFAULT_CERTIFICATIONS);
    const impact_breakdown = parseJsonArray(body.impact_breakdown, db.DEFAULTS.DEFAULT_IMPACT_BREAKDOWN);
    const lifecycle_stages = parseJsonArray(body.lifecycle_stages, db.DEFAULTS.DEFAULT_LIFECYCLE);
    const care_guidelines = parseJsonArray(body.care_guidelines, db.DEFAULTS.DEFAULT_GUIDELINES);

    return [
        body.name?.trim() || '',
        body.category?.trim() || '',
        body.tagline?.trim() || '',
        specs[0]?.value || body.capacity?.trim() || '',
        specs[1]?.value || body.temperature?.trim() || '',
        specs[2]?.value || body.weight?.trim() || '',
        JSON.stringify(specs),
        body.material_desc?.trim() || '',
        body.material_badge?.trim() || 'Inox 304',
        JSON.stringify(materials),
        body.cert_desc?.trim() || '',
        JSON.stringify(certifications),
        body.co2_emission?.trim() || '',
        body.impact_desc?.trim() || '',
        body.impact_comparison?.trim() || '',
        JSON.stringify(impact_breakdown),
        body.lifecycle_desc?.trim() || '',
        JSON.stringify(lifecycle_stages),
        JSON.stringify(care_guidelines),
        body.batch_code?.trim() || '',
        body.release_date?.trim() || '',
        body.image_data || null
    ];
}

app.post('/api/admin/products', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id || !req.body.name) return res.status(400).json({ error: 'Mã sản phẩm (ID) và Tên sản phẩm là bắt buộc!' });
        const vals = [id.trim(), ...extractProductPayload(req.body)];
        await db.query(`INSERT INTO products (
            id, name, category, tagline, capacity, temperature, weight, specs,
            material_desc, material_badge, materials,
            cert_desc, certifications,
            co2_emission, impact_desc, impact_comparison, impact_breakdown,
            lifecycle_desc, lifecycle_stages, care_guidelines,
            batch_code, release_date, image_data, updated_at
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8::jsonb,
            $9,$10,$11::jsonb,
            $12,$13::jsonb,
            $14,$15,$16,$17::jsonb,
            $18,$19::jsonb,$20::jsonb,
            $21,$22,$23,NOW()
        )`, vals);
        res.json({ message: 'Đã thêm sản phẩm DPP mới thành công!', id });
    } catch (err) {
        console.error('Create product error:', err);
        res.status(400).json({ error: err.code === '23505' ? 'Mã sản phẩm đã tồn tại!' : 'Không thể thêm sản phẩm: ' + err.message });
    }
});

app.put('/api/admin/products/:id', verifyAdminToken, async (req, res) => {
    try {
        const vals = [...extractProductPayload(req.body), req.params.id];
        const result = await db.query(`UPDATE products SET
            name=$1, category=$2, tagline=$3, capacity=$4, temperature=$5, weight=$6, specs=$7::jsonb,
            material_desc=$8, material_badge=$9, materials=$10::jsonb,
            cert_desc=$11, certifications=$12::jsonb,
            co2_emission=$13, impact_desc=$14, impact_comparison=$15, impact_breakdown=$16::jsonb,
            lifecycle_desc=$17, lifecycle_stages=$18::jsonb, care_guidelines=$19::jsonb,
            batch_code=$20, release_date=$21, image_data=$22, updated_at=NOW()
            WHERE id=$23`, vals);
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
    app.listen(PORT, () => console.log(`DPP Mindset chạy tại cổng ${PORT}`));
}).catch(err => {
    console.error('Không thể khởi tạo database:', err);
    process.exit(1);
});