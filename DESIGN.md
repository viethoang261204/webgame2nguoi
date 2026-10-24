# Hệ thống giao diện (UI)

Tài liệu này mô tả các thư viện giao diện đang dùng, design token, các thành phần dùng chung và cách thêm một game mới sao cho đồng bộ với phần còn lại của trang.

## Thư viện

| Thư viện | Phiên bản | Dùng để làm gì | Nạp từ |
| --- | --- | --- | --- |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | 3.4.19 | Utility CSS cho toàn bộ trang chủ và các game mới | Build bằng CLI ra `public/shared/app.css` |
| [daisyUI](https://github.com/saadeghi/daisyui) | 4.12.24 | Component trên nền Tailwind: `btn`, `modal`, `tabs`, `join`, `badge`, `alert`, `select`... | Plugin Tailwind, build cùng file CSS |
| [Lucide](https://github.com/lucide-icons/lucide) | 0.460.0 | Toàn bộ icon (không dùng emoji trong giao diện) | `unpkg.com/lucide@0.460.0` |
| [chessground](https://github.com/lichess-org/chessground) | 9.2.1 | Bàn cờ vua của lichess: kéo thả, hiệu ứng, gợi ý nước đi | `cdn.jsdelivr.net/npm/chessground@9.2.1/+esm` |
| [chess.js](https://github.com/jhlywa/chess.js) | 1.4.0 | Luật cờ vua (server kiểm tra nước đi, client tính ô đi được) | npm (server) và jsDelivr ESM (client) |
| [qrcodejs](https://github.com/davidshimjs/qrcodejs) | 1.0.0 | Mã QR để mời bạn vào phòng | cdnjs |
| [flag-icons](https://github.com/lipis/flag-icons) | 7.6.0 | Lá cờ các nước trên thẻ game Lật hình | jsDelivr |
| [canvas-confetti](https://github.com/catdad/canvas-confetti) | 1.9.3 | Pháo giấy khi thắng (Caro, Pikachu) | jsDelivr |
| Be Vietnam Pro | | Font chữ chính, hiển thị tiếng Việt có dấu chuẩn | Google Fonts |

Caro và Pikachu được làm trước nên vẫn dùng CSS riêng (`public/caro/style.css`, `public/pikachu/style.css`, `public/shared/ui.css`), nhưng cùng tông màu tối và cùng bộ icon Lucide.

## Build CSS

Tailwind chỉ sinh ra những class thực sự xuất hiện trong mã nguồn, nên **sau khi thêm hoặc sửa class trong HTML/JS phải build lại**:

```bash
npm run build:css     # build một lần, có minify
npm run watch:css     # vừa sửa vừa build lại tự động
```

File kết quả `public/shared/app.css` được commit vào git, nên Render chỉ cần `npm install` là chạy được, không phải build gì thêm.

Tailwind quét các file: `public/index.html`, `public/play.html`, `public/shared/*.js`, `public/games/**/*.js` (xem `tailwind.config.js`). Class phải được viết đầy đủ trong mã, không ghép chuỗi kiểu `'bg-' + color`.

## Design token

Theme daisyUI tên `arena`, khai báo trong `tailwind.config.js`:

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| `primary` | `#6d5dfc` | Nút chính, viền người đang tới lượt, nhấn mạnh |
| `secondary` | `#2dd4bf` | Điểm nhấn phụ |
| `accent` | `#f5b544` | Điểm nhấn ấm (huy chương, cảnh báo nhẹ) |
| `base-100 / 200 / 300` | `#121527` / `#0d101e` / `#090b16` | Nền thẻ / nền phụ / nền trang |
| `base-content` | `#e7e9f6` | Chữ chính |
| `neutral-content` | `#c9cde3` | Chữ phụ (thường dùng kèm độ mờ `/60`, `/70`) |
| `success / warning / error` | `#34d399` / `#fbbf24` / `#fb7185` | Thông báo, kết quả thắng / thua |
| Bo góc | thẻ `1rem`, nút `0.75rem`, badge `0.5rem` | |

Quy ước khác:

- Chỉ dùng nền tối, không có chế độ sáng.
- Chữ phụ dùng `text-neutral-content/60`–`/70`, không tự đặt màu xám mới.
- Màu riêng của từng bên trong game (Trắng/Đen, Đỏ/Vàng...) khai báo trong `meta.sides` của file luật, giao diện lấy qua `api.sideColor(seat)`.

## Thành phần dùng chung (`src/app.css`)

| Class | Mô tả |
| --- | --- |
| `.app-bg` | Nền trang với 2 quầng sáng tím và xanh ngọc |
| `.grid-bg` | Lưới mờ trang trí (trang chủ) |
| `.panel` | Thẻ nền tối bo góc có viền mảnh, dùng cho mọi khối nội dung |
| `.chip` | Nhãn nhỏ (tag của game) |
| `.kbd-code` | Mã phòng dạng chữ đơn cách |
| `.player`, `.player.active` | Thanh người chơi, viền sáng khi tới lượt |
| `.avatar-ini` | Avatar tròn bằng chữ cái đầu của tên, màu sinh từ tên |
| `.clock`, `.clock.running`, `.clock.low` | Đồng hồ cờ: đang chạy thì đảo màu, dưới 20 giây thì chuyển đỏ |
| `.hint-dot` | Chấm gợi ý ô đi được |
| `.anim-drop / pop / flip / fade / pulse-ring` | Hiệu ứng thả quân, xuất hiện, lật, mờ dần, nhấp nháy viền |

Nguyên tắc: **không dùng emoji hay hình tự vẽ làm icon**. Icon lấy từ Lucide (`<i data-lucide="ten-icon"></i>` rồi gọi `lucide.createIcons()`). Ảnh minh họa game trên trang chủ là ảnh chụp màn hình thật của chính game (`public/assets/thumbs/*.webp`).

## Cấu trúc một game 2 người

```
games/rules/<id>.js      luật, chạy trên server (kiểm tra mọi nước đi)
public/games/<id>.js     giao diện bàn cờ (ES module)
public/play.html         khung trang dùng chung cho mọi game: /g/<id>/
public/shared/play.js    phòng, người chơi, đồng hồ, kết quả, mời bạn
games/engine.js          server chung: phòng, lượt, đồng hồ, xin hòa, đầu hàng, chơi lại
```

### File luật (`games/rules/<id>.js`)

```js
module.exports = {
  meta: { name, desc, sides: [{ name, color }, { name, color }], rules: ['...'] },
  settings: { time: { label, default, options: [[0, 'Không giới hạn'], [300, '5 phút']] } }, // tùy chọn
  clock: true,      // có đồng hồ hay không
  local: true,      // cho phép 2 người chơi trên cùng máy (false nếu game có thông tin ẩn)
  init(settings) {},         // trả về trạng thái ván mới (phải chuyển được sang JSON)
  turn(state) {},            // 0 | 1 | 'both'
  move(state, seat, m) {},   // sửa state; trả về chuỗi lỗi nếu nước đi sai
  result(state) {},          // null hoặc { winner: 0 | 1 | -1, reason }
  view(state, seat) {},      // (tùy chọn) ẩn thông tin bí mật, thêm dữ liệu gợi ý cho client
};
```

### Module giao diện (`public/games/<id>.js`)

```js
export default {
  mount({ board, controls, side }, api) {}, // dựng bàn cờ, gọi api.setAspect(rộng / cao)
  render(view, prev) {},                    // vẽ lại theo trạng thái mới
  info(view, seat) {},                      // (tùy chọn) dòng phụ trên thanh người chơi, ví dụ "12 quân"
  status(view) {},                          // (tùy chọn) HTML trạng thái riêng
  resize(w, h) {},                          // (tùy chọn) khi bàn cờ đổi kích thước
};
```

`view` gồm: `state` (kết quả `view()` của luật), `turn`, `seat` (0, 1, `'both'` khi chơi cùng máy, `null` khi đang xem), `canMove`, `flip` (true khi bạn là bên 1, cần xoay bàn), `result`, `players`, `clocks`, `score`.

`api` gồm: `move(m)` (trả về Promise, tự hiện lỗi nếu server từ chối), `toast(msg, type)`, `icons()`, `sideColor(seat)`, `sideName(seat)`, `setAspect(a)`.

### Thêm một game mới

1. Tạo `games/rules/<id>.js` và thêm `<id>` vào danh sách trong `games/engine.js`.
2. Tạo `public/games/<id>.js`.
3. Thêm thẻ game vào mảng `GAMES` trong `public/index.html`, kèm ảnh `public/assets/thumbs/<id>.webp` (chụp màn hình bàn cờ thật, rộng tối đa 720px).
4. Chạy `npm run build:css`.

## Khôi phục phòng sau khi deploy

Mỗi lần trạng thái thay đổi, server gửi cho client một bản trạng thái phòng **mã hóa AES-256-GCM** (`seal`). Server khởi động lại (deploy, Render ngủ dậy) thì client tự gửi lại bản này để dựng lại phòng. Vì đã mã hóa nên game có thông tin ẩn như Hải chiến hay Lật hình cũng không bị lộ.

Khóa mã hóa lấy từ biến môi trường `SECRET`. `render.yaml` để Render tự sinh giá trị này một lần và giữ nguyên qua các lần deploy. Thiếu `SECRET` thì game vẫn chạy bình thường, chỉ là không khôi phục được phòng sau khi server khởi động lại.
