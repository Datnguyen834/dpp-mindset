# DPP Mindset

## Deploy trên Render + Neon PostgreSQL

1. Tạo database PostgreSQL trên Neon.
2. Trong Render > Web Service > Environment, thêm:
   - `DATABASE_URL`: Neon connection string (ưu tiên connection string có `sslmode=require`).
   - `JWT_SECRET`: chuỗi bí mật dài, ngẫu nhiên.
   - `DEFAULT_ADMIN_USERNAME`: `admin` (tuỳ chọn).
   - `DEFAULT_ADMIN_PASSWORD`: mật khẩu admin mạnh (tuỳ chọn; mặc định tạm là `admin@123` nếu chưa cấu hình).
3. Build Command: `npm install`
4. Start Command: `npm start`

Ứng dụng tự tạo bảng `users`, `products` và cột `image_data` nếu chưa có. Nếu bảng `products` rỗng, ứng dụng thêm sản phẩm mẫu `MS-THERMO-500`.

## Ảnh sản phẩm

Admin có thể chọn ảnh JPG/PNG/WEBP tối đa 4 MB ở phần thêm/sửa sản phẩm. Ảnh được lưu dạng Data URL trong cột `products.image_data` của Neon và hiển thị ở trang DPP công khai. Để tối ưu dung lượng, nên nén ảnh trước khi tải lên.

## Lưu ý chuyển dữ liệu

Bản mã nguồn ZIP ban đầu dùng SQLite (`sqlite3`, `data/dpp.db`), không có `DATABASE_URL` hoặc cấu hình Neon. Bản này đã chuyển lớp dữ liệu sang Neon PostgreSQL. Nếu dữ liệu cũ chỉ nằm trong file SQLite, cần xuất/nhập dữ liệu sang Neon riêng; không tự xoá hay tự di chuyển dữ liệu cũ.
