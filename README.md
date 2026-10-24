# Game 2 Người

Trang game online 2 người, không cần tài khoản: tạo phòng, gửi link là solo.

| Game | Đường dẫn | Chế độ |
| --- | --- | --- |
| Caro Vô Hạn | `/caro/` | Online qua link, đấu máy, 2 người 1 máy, đổi theme mỗi ván |
| Pikachu Solo | `/pikachu/` | Online 1v1 cùng map đua giờ, luyện tập phá kỷ lục |

Mất kết nối hoặc server restart đều tự vào lại phòng, giữ nguyên tiến độ.

## Chạy local
```
npm install
npm start
```
Mở http://localhost:3000

## Cấu trúc
- `server.js`: Express + Socket.io, Caro chạy ở namespace mặc định
- `games/pikachu.js`: server Pikachu (namespace `/pikachu`)
- `public/index.html`: trang chủ chọn game
- `public/caro/`, `public/pikachu/`: từng game
- `public/shared/ui.css`: style dùng chung

## Deploy Render
Dùng `render.yaml` (New → Blueprint), hoặc Web Service với Build `npm install`, Start `npm start`.
