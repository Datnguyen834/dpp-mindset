const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'data', 'dpp.db');

// Đảm bảo thư mục data luôn tồn tại
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Lỗi kết nối SQLite:', err.message);
    } else {
        console.log('✅ Đã kết nối tới SQLite Database (data/dpp.db).');
        initDatabase();
    }
});

function initDatabase() {
    db.serialize(() => {
        // 1. Bảng Quản trị viên (Users)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'admin'
        )`);

        // 2. Bảng Sản phẩm Hộ chiếu số (Products)
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tagline TEXT,
            capacity TEXT,
            temperature TEXT,
            weight TEXT,
            material_desc TEXT,
            co2_emission TEXT,
            batch_code TEXT DEFAULT '#MS-2026-VN08',
            release_date TEXT DEFAULT '15/02/2026',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            // Khởi tạo sản phẩm mặc định nếu bảng trống
            db.get(`SELECT COUNT(*) as count FROM products`, (err, row) => {
                if (!err && row && row.count === 0) {
                    const stmt = db.prepare(`INSERT INTO products (
                        id, name, tagline, capacity, temperature, weight, material_desc, co2_emission, batch_code, release_date, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`);
                    stmt.run(
                        'MS-THERMO-500',
                        'Bình giữ nhiệt Mindset',
                        'Đồng hành cùng bạn trong mọi hành trình',
                        '500ml',
                        '12h nóng / 24h lạnh',
                        '320g',
                        'Sản phẩm được làm từ thép không gỉ 304 cao cấp, an toàn cho sức khỏe và thân thiện với môi trường.',
                        '1.24 kg',
                        '#MS-2026-VN08',
                        '15/02/2026'
                    );
                    stmt.finalize();
                    console.log('✅ Đã khởi tạo sản phẩm mặc định: MS-THERMO-500');
                }
            });

            // Khởi tạo tài khoản Admin mặc định: admin / admin@123
            db.get(`SELECT * FROM users WHERE username = 'admin'`, async (err, row) => {
                if (!err && !row) {
                    const hashedPwd = await bcrypt.hash('admin@123', 10);
                    db.run(
                        `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
                        ['admin', hashedPwd, 'admin'],
                        () => console.log('✅ Đã tạo tài khoản Admin mặc định: admin / admin@123')
                    );
                }
            });
        });
    });
}

module.exports = db;
