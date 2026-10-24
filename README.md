# Game Cùng Bạn

Trang game 2 người chơi online, không cần tài khoản: tạo phòng, gửi link hoặc mã QR là chơi. Có chế độ hai người trên cùng một máy.

| Game | Đường dẫn | Ghi chú |
| --- | --- | --- |
| Cờ vua | `/g/chess/` | Luật đầy đủ (chess.js), bàn cờ chessground, đồng hồ có cộng giây |
| Cờ tướng | `/g/xiangqi/` | Quân chữ Hán, luật tướng không đối mặt, đồng hồ |
| Caro Vô Hạn | `/caro/` | Bàn vô hạn, đấu máy, đổi theme mỗi ván |
| Cờ đam | `/g/checkers/` | Checkers 8x8, bắt buộc ăn, ăn liên tiếp, phong vua |
| Cờ lật | `/g/othello/` | Othello, tự mất lượt khi không có nước đi |
| Bức tường | `/g/quoridor/` | Quoridor 9x9, 10 tường mỗi người |
| Hải chiến | `/g/battleship/` | Xếp tàu bí mật, bắn trúng được bắn tiếp |
| Ô ăn quan | `/g/oanquan/` | Luật dân gian: rải, ăn liên tiếp, rải lại khi hết dân |
| Nối ô | `/g/dots/` | Dots and Boxes 5x5 |
| Lật hình | `/g/memory/` | 18 cặp lá cờ các nước |
| Thả 4 | `/g/connect4/` | Connect Four 7x6 |
| Pikachu Solo | `/pikachu/` | Cùng map, đua giờ |

Mọi nước đi đều được server kiểm tra. Rớt mạng, tải lại trang hay server deploy lại đều tự vào lại đúng phòng.

## Chạy local

```bash
npm install
npm start            # http://localhost:3000
npm run watch:css    # khi sửa giao diện (Tailwind)
```

## Deploy Render

Dùng `render.yaml` (New → Blueprint). Biến `SECRET` được Render tự sinh để khôi phục phòng sau mỗi lần deploy.

## Giao diện

Tailwind CSS + daisyUI + Lucide. Chi tiết thư viện, design token, thành phần và cách thêm game mới: xem [DESIGN.md](DESIGN.md).
