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

// Endpoint nhẹ cho Cron-job / UptimeRobot giữ server thức
app.get('/ping', (req, res) => res.status(200).send('OK'));

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

function parseJsonSafe(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string' && raw.trim()) {
        try { return JSON.parse(raw); } catch (e) { return fallback; }
    }
    return fallback;
}

function normalizeSpecs(rawSpecs, fallbackObj = {}) {
    const arr = parseJsonSafe(rawSpecs, []);
    const cleaned = (Array.isArray(arr) ? arr : [])
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
    return cleaned;
}

function normalizeMaterials(rawMaterials) {
    const arr = parseJsonSafe(rawMaterials, []);
    return (Array.isArray(arr) ? arr : [])
        .map(item => ({
            name: String(item?.name || '').trim(),
            ratio: String(item?.ratio || '').trim(),
            desc: String(item?.desc || '').trim()
        }))
        .filter(item => item.name !== '' || item.desc !== '');
}

function normalizeCertifications(rawCerts) {
    const arr = parseJsonSafe(rawCerts, []);
    return (Array.isArray(arr) ? arr : [])
        .map(item => ({
            badge: String(item?.badge || '').trim(),
            title: String(item?.title || '').trim(),
            desc: String(item?.desc || '').trim()
        }))
        .filter(item => item.badge !== '' || item.title !== '' || item.desc !== '');
}

function normalizeEnvImpact(rawEnv) {
    const obj = parseJsonSafe(rawEnv, {});
    const breakdownRaw = Array.isArray(obj?.breakdown) ? obj.breakdown : [];
    const breakdown = breakdownRaw
        .map(item => ({
            label: String(item?.label || '').trim(),
            value: String(item?.value || '').trim(),
            percent: Number.isFinite(Number(item?.percent)) ? Number(item.percent) : 0
        }))
        .filter(item => item.label !== '' || item.value !== '');

    return {
        summary: String(obj?.summary || '').trim(),
        comparison: String(obj?.comparison || '').trim(),
        breakdown
    };
}

function normalizeLifecycle(rawLifecycle) {
    const arr = parseJsonSafe(rawLifecycle, []);
    return (Array.isArray(arr) ? arr : [])
        .map(item => ({
            short_label: String(item?.short_label || '').trim(),
            title: String(item?.title || '').trim(),
            desc: String(item?.desc || '').trim()
        }))
        .filter(item => item.short_label !== '' || item.title !== '' || item.desc !== '');
}

function normalizeCareInstructions(rawCare) {
    const arr = parseJsonSafe(rawCare, []);
    return (Array.isArray(arr) ? arr : [])
        .map(item => ({
            short_label: String(item?.short_label || '').trim(),
            title: String(item?.title || '').trim(),
            desc: String(item?.desc || '').trim()
        }))
        .filter(item => item.short_label !== '' || item.title !== '' || item.desc !== '');
}

function formatProductRow(row) {
    if (!row) return null;
    return {
        ...row,
        category: row.category || '',
        specs: normalizeSpecs(row.specs, row),
        material_badge: row.material_badge || '',
        material_desc: row.material_desc || '',
        materials: normalizeMaterials(row.materials),
        cert_summary: row.cert_summary || '',
        certifications: normalizeCertifications(row.certifications),
        co2_emission: row.co2_emission || '',
        env_impact: normalizeEnvImpact(row.env_impact),
        lifecycle_summary: row.lifecycle_summary || '',
        lifecycle: normalizeLifecycle(row.lifecycle),
        care_instructions: normalizeCareInstructions(row.care_instructions)
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

const productFields = [
    'name', 'category', 'tagline', 'capacity', 'temperature', 'weight',
    'specs', 'material_badge', 'material_desc', 'materials',
    'cert_summary', 'certifications', 'co2_emission', 'env_impact',
    'lifecycle_summary', 'lifecycle', 'care_instructions',
    'batch_code', 'release_date', 'image_data'
];

function productValues(body) {
    const specs = normalizeSpecs(body.specs, body);
    const materials = normalizeMaterials(body.materials);
    const certifications = normalizeCertifications(body.certifications);
    const env_impact = normalizeEnvImpact(body.env_impact);
    const lifecycle = normalizeLifecycle(body.lifecycle);
    const care_instructions = normalizeCareInstructions(body.care_instructions);

    const cap = specs[0]?.value || body.capacity?.trim() || '';
    const temp = specs[1]?.value || body.temperature?.trim() || '';
    const weight = specs[2]?.value || body.weight?.trim() || '';

    return [
        body.name?.trim() || '',
        body.category?.trim() || '',
        body.tagline?.trim() || '',
        cap,
        temp,
        weight,
        JSON.stringify(specs),
        body.material_badge?.trim() || '',
        body.material_desc?.trim() || '',
        JSON.stringify(materials),
        body.cert_summary?.trim() || '',
        JSON.stringify(certifications),
        body.co2_emission?.trim() || '',
        JSON.stringify(env_impact),
        body.lifecycle_summary?.trim() || '',
        JSON.stringify(lifecycle),
        JSON.stringify(care_instructions),
        body.batch_code?.trim() || '',
        body.release_date?.trim() || '',
        body.image_data || null
    ];
}

app.post('/api/admin/products', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.body;
        if (!id || !req.body.name) return res.status(400).json({ error: 'Mã sản phẩm (ID) và Tên sản phẩm là bắt buộc!' });
        const vals = [id.trim(), ...productValues(req.body)];
        await db.query(`INSERT INTO products (id, ${productFields.join(', ')}, updated_at)
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,
                $8::jsonb,$9,$10,$11::jsonb,
                $12,$13::jsonb,$14,$15::jsonb,
                $16,$17::jsonb,$18::jsonb,
                $19,$20,$21,NOW()
            )`, vals);
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
            name=$1, category=$2, tagline=$3, capacity=$4, temperature=$5, weight=$6,
            specs=$7::jsonb, material_badge=$8, material_desc=$9, materials=$10::jsonb,
            cert_summary=$11, certifications=$12::jsonb, co2_emission=$13, env_impact=$14::jsonb,
            lifecycle_summary=$15, lifecycle=$16::jsonb, care_instructions=$17::jsonb,
            batch_code=$18, release_date=$19, image_data=$20, updated_at=NOW()
            WHERE id=$21`, vals);
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
