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

const DEFAULT_SPECS = [
    { label: 'Dung tích', value: '500ml' },
    { label: 'Giữ nhiệt', value: '12h nóng / 24h lạnh' },
    { label: 'Trọng lượng', value: '320g' }
];

const DEFAULT_MATERIALS = [
    {
        name: 'Thép không gỉ Austenitic SUS304',
        ratio: '82% Khối lượng',
        desc: 'Chứa 18% Crom và 8% Niken, chống oxy hóa tuyệt đối, không chứa BPA và không thôi nhiễm kim loại nặng.'
    },
    {
        name: 'Nắp nhựa PP nguyên sinh & Gioăng Silicon y tế',
        ratio: '14% Khối lượng',
        desc: 'Chịu nhiệt lên tới 120°C, tháo rời dễ dàng để vệ sinh và tái chế riêng biệt.'
    },
    {
        name: 'Sơn tĩnh điện Powder Coating không dung môi',
        ratio: '4% Khối lượng',
        desc: 'Bề mặt nhám Matte Black chống bám vân tay, không phát thải VOC trong quá trình phủ.'
    }
];

const DEFAULT_CERTIFICATIONS = [
    {
        badge: 'ISO',
        title: 'ISO 9001:2015 & ISO 14001',
        desc: 'Hệ thống quản lý chất lượng và môi trường chuẩn quốc tế.'
    },
    {
        badge: 'RoHS',
        title: 'Chứng chỉ RoHS Châu Âu',
        desc: 'Cam kết 100% không chì (Lead-free), thủy ngân hay Cadmium.'
    },
    {
        badge: 'SGS',
        title: 'Kiểm định tiếp xúc thực phẩm SGS',
        desc: 'Đạt chuẩn QCVN 12-3:2011/BYT về an toàn vệ sinh thực phẩm.'
    }
];

const DEFAULT_ENV_IMPACT = {
    summary: 'Giảm phát thải CO₂ ≈ 32% so với sản phẩm truyền thống.',
    comparison: 'Giảm 32% so với bình giữ nhiệt thông thường (1.82 kg)',
    breakdown: [
        { label: 'Nguyên liệu (85% Inox tái chế)', value: '0.62 kg', percent: 50 },
        { label: 'Sản xuất bằng điện mặt trời áp mái', value: '0.34 kg', percent: 27 },
        { label: 'Bao bì giấy FSC & Vận chuyển xanh', value: '0.28 kg', percent: 23 }
    ]
};

const DEFAULT_LIFECYCLE = [
    {
        short_label: 'Nguyên liệu bền vững',
        title: 'GIAI ĐOẠN 1 • NGUYÊN LIỆU BỀN VỮNG',
        desc: 'Sử dụng 85% thép không gỉ 304 tái chế có chứng nhận nguồn gốc, giảm khai thác quặng mới.'
    },
    {
        short_label: 'Sản xuất hiện đại',
        title: 'GIAI ĐOẠN 2 • SẢN XUẤT HIỆN ĐẠI',
        desc: 'Dây chuyền hàn laser không chì, sử dụng năng lượng tái tạo và tuần hoàn 95% lượng nước làm mát.'
    },
    {
        short_label: 'Phân phối thông minh',
        title: 'GIAI ĐOẠN 3 • PHÂN PHỐI THÔNG MINH',
        desc: 'Hộp giấy Kraft đạt chuẩn FSC 100% không màng nilon, mực in đậu nành thân thiện sinh thái.'
    },
    {
        short_label: 'Tái chế vì tương lai',
        title: 'GIAI ĐOẠN 4 • TÁI CHẾ VÌ TƯƠNG LAI',
        desc: 'Chương trình "Thu cũ đổi xanh" tại mọi điểm bán Mindset — hoàn tiền 15% khi gửi lại bình cũ để tái chế.'
    }
];

const DEFAULT_CARE = [
    {
        short_label: 'Tránh đựng đồ quá nóng',
        title: 'Tránh đựng đồ quá nóng/có gas',
        desc: 'Chừa khoảng trống 2cm dưới cổ bình khi đựng nước sôi trên 90°C để tránh áp suất đẩy nắp.'
    },
    {
        short_label: 'Vệ sinh định kỳ bằng nước ấm',
        title: 'Vệ sinh định kỳ bằng nước ấm',
        desc: 'Sử dụng cọ mềm cùng nước ấm hoặc baking soda pha loãng; không dùng búi sắt chà xát lòng bình.'
    },
    {
        short_label: 'Bảo quản nơi khô ráo',
        title: 'Bảo quản nơi khô ráo',
        desc: 'Để ráo tự nhiên và mở nắp khi không sử dụng trong thời gian dài.'
    },
    {
        short_label: 'Sử dụng bền lâu cùng Mindset',
        title: 'Thay thế linh kiện dễ dàng',
        desc: 'Mindset cung cấp gioăng silicon và nắp lẻ thay thế suốt vòng đời sản phẩm.'
    }
];

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
            category TEXT DEFAULT '',
            tagline TEXT DEFAULT '',
            capacity TEXT DEFAULT '',
            temperature TEXT DEFAULT '',
            weight TEXT DEFAULT '',
            specs JSONB DEFAULT '[]'::jsonb,
            material_badge TEXT DEFAULT '',
            material_desc TEXT DEFAULT '',
            materials JSONB DEFAULT '[]'::jsonb,
            cert_summary TEXT DEFAULT '',
            certifications JSONB DEFAULT '[]'::jsonb,
            co2_emission TEXT DEFAULT '',
            env_impact JSONB DEFAULT '{}'::jsonb,
            lifecycle_summary TEXT DEFAULT '',
            lifecycle JSONB DEFAULT '[]'::jsonb,
            care_instructions JSONB DEFAULT '[]'::jsonb,
            batch_code TEXT DEFAULT '',
            release_date TEXT DEFAULT '',
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            image_data TEXT
        );
        ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS material_badge TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS cert_summary TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS env_impact JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS lifecycle_summary TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS lifecycle JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS care_instructions JSONB DEFAULT '[]'::jsonb;
    `);

    // Đồng bộ dữ liệu cho các sản phẩm đã có sẵn nhưng chưa có dữ liệu chi tiết ở các mục mới
    const existing = await pool.query('SELECT * FROM products');
    for (const row of existing.rows) {
        const hasSpecs = Array.isArray(row.specs) && row.specs.length > 0;
        if (!hasSpecs) {
            const migratedSpecs = [];
            if (row.capacity) migratedSpecs.push({ label: 'Dung tích', value: row.capacity });
            if (row.temperature) migratedSpecs.push({ label: 'Giữ nhiệt', value: row.temperature });
            if (row.weight) migratedSpecs.push({ label: 'Trọng lượng', value: row.weight });
            if (migratedSpecs.length > 0) {
                await pool.query('UPDATE products SET specs = $1::jsonb WHERE id = $2', [JSON.stringify(migratedSpecs), row.id]);
            }
        }

        // Tự động bổ sung dữ liệu mẫu chuẩn cho sản phẩm mặc định MS-THERMO-500 nếu các mục mới đang trống
        if (row.id === 'MS-THERMO-500') {
            const matEmpty = !Array.isArray(row.materials) || row.materials.length === 0;
            const certEmpty = !Array.isArray(row.certifications) || row.certifications.length === 0;
            const envEmpty = !row.env_impact || Object.keys(row.env_impact).length === 0;
            const lifeEmpty = !Array.isArray(row.lifecycle) || row.lifecycle.length === 0;
            const careEmpty = !Array.isArray(row.care_instructions) || row.care_instructions.length === 0;

            if (matEmpty || certEmpty || envEmpty || lifeEmpty || careEmpty) {
                await pool.query(`
                    UPDATE products SET
                        material_badge = COALESCE(NULLIF(material_badge, ''), $1),
                        materials = CASE WHEN jsonb_typeof(materials) = 'array' AND jsonb_array_length(materials) > 0 THEN materials ELSE $2::jsonb END,
                        cert_summary = COALESCE(NULLIF(cert_summary, ''), $3),
                        certifications = CASE WHEN jsonb_typeof(certifications) = 'array' AND jsonb_array_length(certifications) > 0 THEN certifications ELSE $4::jsonb END,
                        env_impact = CASE WHEN env_impact IS NOT NULL AND env_impact != '{}'::jsonb THEN env_impact ELSE $5::jsonb END,
                        lifecycle_summary = COALESCE(NULLIF(lifecycle_summary, ''), $6),
                        lifecycle = CASE WHEN jsonb_typeof(lifecycle) = 'array' AND jsonb_array_length(lifecycle) > 0 THEN lifecycle ELSE $7::jsonb END,
                        care_instructions = CASE WHEN jsonb_typeof(care_instructions) = 'array' AND jsonb_array_length(care_instructions) > 0 THEN care_instructions ELSE $8::jsonb END
                    WHERE id = 'MS-THERMO-500'
                `, [
                    'Inox 304',
                    JSON.stringify(DEFAULT_MATERIALS),
                    'Đạt các tiêu chuẩn chất lượng và an toàn quốc tế.',
                    JSON.stringify(DEFAULT_CERTIFICATIONS),
                    JSON.stringify(DEFAULT_ENV_IMPACT),
                    'Từ nguyên liệu đến tái chế, Mindset luôn đồng hành cùng bạn trong hành trình xanh.',
                    JSON.stringify(DEFAULT_LIFECYCLE),
                    JSON.stringify(DEFAULT_CARE)
                ]);
            }
        }
    }

    const count = await pool.query('SELECT COUNT(*)::int AS count FROM products');
    if (count.rows[0].count === 0) {
        await pool.query(`INSERT INTO products (
            id, name, category, tagline, capacity, temperature, weight, specs,
            material_badge, material_desc, materials,
            cert_summary, certifications,
            co2_emission, env_impact,
            lifecycle_summary, lifecycle,
            care_instructions, batch_code, release_date
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8::jsonb,
            $9,$10,$11::jsonb,
            $12,$13::jsonb,
            $14,$15::jsonb,
            $16,$17::jsonb,
            $18::jsonb,$19,$20
        )`, [
            'MS-THERMO-500',
            'Bình giữ nhiệt Mindset',
            'Bình giữ nhiệt',
            'Đồng hành cùng bạn trong mọi hành trình',
            '500ml',
            '12h nóng / 24h lạnh',
            '320g',
            JSON.stringify(DEFAULT_SPECS),
            'Inox 304',
            'Sản phẩm được làm từ thép không gỉ 304 cao cấp, an toàn cho sức khỏe và thân thiện với môi trường.',
            JSON.stringify(DEFAULT_MATERIALS),
            'Đạt các tiêu chuẩn chất lượng và an toàn quốc tế.',
            JSON.stringify(DEFAULT_CERTIFICATIONS),
            '1.24 kg',
            JSON.stringify(DEFAULT_ENV_IMPACT),
            'Từ nguyên liệu đến tái chế, Mindset luôn đồng hành cùng bạn trong hành trình xanh.',
            JSON.stringify(DEFAULT_LIFECYCLE),
            JSON.stringify(DEFAULT_CARE),
            '#MS-2026-VN08',
            '15/02/2026'
        ]);
    }

    const admin = await pool.query("SELECT id FROM users WHERE username = 'admin'");
    if (admin.rowCount === 0) {
        const hash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin@123', 10);
        await pool.query('INSERT INTO users (username,password,role) VALUES ($1,$2,$3)',
            [process.env.DEFAULT_ADMIN_USERNAME || 'admin', hash, 'admin']);
        console.log('✅ Đã tạo admin mặc định. Nên đổi mật khẩu ngay sau lần đăng nhập đầu.');
    }
}

module.exports = {
    query: (...args) => pool.query(...args),
    init,
    pool,
    DEFAULTS: {
        DEFAULT_SPECS,
        DEFAULT_MATERIALS,
        DEFAULT_CERTIFICATIONS,
        DEFAULT_ENV_IMPACT,
        DEFAULT_LIFECYCLE,
        DEFAULT_CARE
    }
};
