require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
    console.error('❌ Thiếu DATABASE_URL. Hãy thêm Neon connection string trong Render > Environment.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

async function init() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'admin'
        );
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tagline TEXT DEFAULT '',
            capacity TEXT DEFAULT '500ml',
            temperature TEXT DEFAULT '12h nóng / 24h lạnh',
            weight TEXT DEFAULT '320g',
            material_desc TEXT DEFAULT '',
            co2_emission TEXT DEFAULT '1.24 kg',
            batch_code TEXT DEFAULT '#MS-2026-VN08',
            release_date TEXT DEFAULT '15/02/2026',
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            image_data TEXT
        );
        ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data TEXT;
    `);

    const count = await pool.query('SELECT COUNT(*)::int AS count FROM products');
    if (count.rows[0].count === 0) {
        await pool.query(`INSERT INTO products
            (id,name,tagline,capacity,temperature,weight,material_desc,co2_emission,batch_code,release_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            ['MS-THERMO-500','Bình giữ nhiệt Mindset','Đồng hành cùng bạn trong mọi hành trình',
             '500ml','12h nóng / 24h lạnh','320g',
             'Sản phẩm được làm từ thép không gỉ 304 cao cấp, an toàn cho sức khỏe và thân thiện với môi trường.',
             '1.24 kg','#MS-2026-VN08','15/02/2026']);
    }

    const admin = await pool.query("SELECT id FROM users WHERE username = 'admin'");
    if (admin.rowCount === 0) {
        const hash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin@123', 10);
        await pool.query('INSERT INTO users (username,password,role) VALUES ($1,$2,$3)',
            [process.env.DEFAULT_ADMIN_USERNAME || 'admin', hash, 'admin']);
        console.log('✅ Đã tạo admin mặc định. Nên đổi mật khẩu ngay sau lần đăng nhập đầu.');
    }
}

module.exports = { query: (...args) => pool.query(...args), init, pool };
