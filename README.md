# Dự án Hộ chiếu số Sản phẩm (DPP) — Bình giữ nhiệt Mindset

## 1. Cấu trúc thư mục
- `server.js`: Backend Node.js + Express định tuyến phân quyền theo URL và cung cấp REST API.
- `database.js`: Kết nối SQLite (`data/dpp.db`), tự động khởi tạo bảng `users`, `products` và tài khoản Admin mặc định.
- `data/dpp.db`: File cơ sở dữ liệu SQLite chứa thông tin sản phẩm mẫu `MS-THERMO-500`.
- `public/index.html`: Giao diện Hộ chiếu số công khai khi khách hàng quét mã QR (hoàn toàn không hiện nút đăng nhập).
- `public/admin-login.html`: Trang đăng nhập nội bộ dành riêng cho Quản trị viên.
- `public/admin-dashboard.html`: Bảng điều khiển Thêm, Sửa, Xóa (CRUD) sản phẩm DPP.

## 2. Cách cài đặt & Chạy dự án
Mở Terminal trong thư mục `dpp-mindset` và chạy:

```bash
npm install
npm start
```

## 3. Các đường dẫn phân quyền (Chạy trên cùng 1 Server/Domain)
- **Link khách hàng quét mã QR (Công khai, không có nút Login):**
  http://localhost:3000/dpp/MS-THERMO-500
- **Link đăng nhập Quản trị viên (Tài khoản: `admin` / Mật khẩu: `admin@123`):**
  http://localhost:3000/admin/login
- **Link Quản lý Thêm / Sửa / Xóa sản phẩm:**
  http://localhost:3000/admin/dashboard
