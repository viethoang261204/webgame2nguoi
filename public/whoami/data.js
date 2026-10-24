// Bộ nhân vật cho game Tôi Là Ai? (dùng chung cho server và client)
// Mỗi mục: "Tên hiển thị|tên gọi khác|..." (tên gọi khác dùng để chấm đoán)
(function (root) {
  const CATEGORIES = {
    vn: {
      name: '🇻🇳 Người nổi tiếng VN',
      items: [
        'Sơn Tùng M-TP|Sơn Tùng|MTP', 'Đen Vâu|Đen', 'Mỹ Tâm', 'Trấn Thành', 'Hari Won', 'Hoài Linh', 'Trường Giang',
        'Jack|Jack J97|J97', 'HIEUTHUHAI|Hiếu Thứ Hai', 'Bích Phương', 'Hòa Minzy', 'Đức Phúc', 'Erik', 'Tóc Tiên',
        'Đông Nhi', 'Noo Phước Thịnh|Noo', 'Nguyễn Quang Hải|Quang Hải', 'Công Phượng', 'Đặng Văn Lâm|Văn Lâm',
        'Ngô Bảo Châu', 'Độ Mixi|Mixi', 'ViruSs|Virus', 'Hoàng Thùy Linh', 'Chi Pu', 'Ninh Dương Lan Ngọc|Lan Ngọc',
        'Binz', 'Suboi', 'Karik', 'Hồ Ngọc Hà', 'Đàm Vĩnh Hưng|Mr Đàm', 'Lệ Quyên', 'Thùy Tiên', 'Hương Giang',
        'Văn Toàn', 'Tiến Linh', 'Nguyễn Thị Ánh Viên|Ánh Viên', 'Hoàng Xuân Vinh', 'MONO', 'Wren Evans',
        'Ngọc Trinh', 'Quang Linh Vlogs|Quang Linh', 'Khoa Pug', 'Thơ Nguyễn', 'Huỳnh Lập', 'Việt Hương',
        'Xuân Bắc', 'Tự Long', 'Công Lý', 'Ninh Anh Bùi', 'Pháo|Pháo Northside',
      ],
    },
    world: {
      name: '🌍 Người nổi tiếng thế giới',
      items: [
        'Lionel Messi|Messi', 'Cristiano Ronaldo|Ronaldo|CR7', 'Neymar', 'Kylian Mbappé|Mbappe', 'Taylor Swift',
        'Elon Musk', 'Michael Jackson', 'Albert Einstein|Einstein', 'Lisa|Lisa Blackpink', 'Jennie|Jennie Blackpink',
        'Jungkook|Jungkook BTS', 'Bill Gates', 'Steve Jobs', 'Mark Zuckerberg|Zuckerberg', 'Justin Bieber',
        'Rihanna', 'Beyoncé|Beyonce', 'Lady Gaga', 'Ed Sheeran', 'Mr. Bean|Mr Bean', 'Thành Long|Jackie Chan',
        'Lý Tiểu Long|Bruce Lee', 'Châu Tinh Trì|Stephen Chow', 'Leonardo DiCaprio|DiCaprio', 'Tom Cruise',
        'Keanu Reeves', 'Dwayne Johnson|The Rock', 'Will Smith', 'Marilyn Monroe', 'Charlie Chaplin|Vua hề Sác lô',
        'Isaac Newton|Newton', 'Leonardo da Vinci|Da Vinci', 'William Shakespeare|Shakespeare', 'Mozart',
        'Napoleon', 'Nữ hoàng Cleopatra|Cleopatra', 'MrBeast|Mr Beast', 'Billie Eilish', 'Bruno Mars',
        'Usain Bolt', 'Michael Jordan', 'Roger Federer|Federer', 'Lewis Hamilton', 'Rosé|Rose Blackpink',
        'G-Dragon|GDragon', 'Tom Holland', 'Scarlett Johansson', 'Johnny Depp', 'Emma Watson', 'Faker',
      ],
    },
    cartoon: {
      name: '🎬 Hoạt hình & phim',
      items: [
        'Doraemon|Đôrêmon', 'Nobita', 'Conan|Thám tử Conan', 'Songoku|Goku|Son Goku', 'Naruto', 'Luffy|Monkey D Luffy',
        'Pikachu', 'Chuột Mickey|Mickey', 'Mèo Tom|Tom', 'Chuột Jerry|Jerry', 'Shin|Shin cậu bé bút chì', 'Elsa',
        'Người Nhện|Spider-Man|Spiderman', 'Người Sắt|Iron Man|Ironman', 'Người Dơi|Batman', 'Siêu Nhân|Superman',
        'Harry Potter', 'Shrek', 'Minion', 'SpongeBob|Bọt biển SpongeBob', 'Sao biển Patrick|Patrick',
        'Mario|Super Mario', 'Sonic', 'Hello Kitty', 'Gấu Pooh|Winnie the Pooh|Pooh', 'Thánh Gióng',
        'Tôn Ngộ Không|Ngộ Không|Tề Thiên Đại Thánh', 'Trư Bát Giới|Bát Giới', 'Đường Tăng|Đường Tam Tạng',
        'Cô Tấm|Tấm', 'Cám', 'Thạch Sanh', 'Sơn Tinh', 'Thủy Tinh', 'Captain America|Đội trưởng Mỹ', 'Thor',
        'Hulk|Người khổng lồ xanh', 'Joker', 'Bạch Tuyết', 'Lọ Lem|Cinderella', 'Aladdin', 'Vua sư tử Simba|Simba',
        'Thanos', 'Doremi', 'Xuka|Shizuka', 'Chaien|Jaian', 'Xeko|Suneo', 'Peppa Pig|Heo Peppa', 'Olaf',
        'Jack Sparrow|Thuyền trưởng Jack Sparrow', 'Squid Game|Người chơi 456', 'Wednesday|Wednesday Addams',
      ],
    },
    animal: {
      name: '🐾 Động vật',
      items: [
        'Con chó|Chó', 'Con mèo|Mèo', 'Con voi|Voi', 'Con hổ|Hổ|Cọp', 'Sư tử', 'Con khỉ|Khỉ', 'Gấu trúc',
        'Chim cánh cụt|Cánh cụt', 'Cá heo', 'Cá mập', 'Con rắn|Rắn', 'Cá sấu', 'Hươu cao cổ', 'Ngựa vằn',
        'Chuột túi|Kangaroo', 'Con gà|Gà', 'Con vịt|Vịt', 'Con lợn|Lợn|Heo', 'Con bò|Bò', 'Con trâu|Trâu',
        'Con ngựa|Ngựa', 'Con thỏ|Thỏ', 'Con chuột|Chuột', 'Con ếch|Ếch', 'Con rùa|Rùa', 'Bạch tuộc', 'Con sứa|Sứa',
        'Con bướm|Bướm', 'Con ong|Ong', 'Con kiến|Kiến', 'Cú mèo', 'Đại bàng', 'Con vẹt|Vẹt', 'Lạc đà',
        'Gấu Bắc Cực|Gấu trắng', 'Con sóc|Sóc', 'Con nhím|Nhím', 'Tê giác', 'Hà mã', 'Khủng long',
        'Cá voi', 'Con muỗi|Muỗi', 'Con gián|Gián', 'Con dê|Dê', 'Con cừu|Cừu', 'Con cua|Cua', 'Tắc kè hoa',
        'Con lười|Lười', 'Chim công|Công', 'Con dơi|Dơi',
      ],
    },
    job: {
      name: '👷 Nghề nghiệp',
      items: [
        'Bác sĩ', 'Giáo viên|Cô giáo|Thầy giáo', 'Công an|Cảnh sát', 'Lính cứu hỏa', 'Đầu bếp', 'Phi công', 'Ca sĩ',
        'Diễn viên', 'Lập trình viên|Coder|Dev', 'Kỹ sư', 'Nông dân', 'Ngư dân', 'Thợ cắt tóc', 'Tài xế taxi',
        'Shipper|Người giao hàng', 'Luật sư', 'Nhà báo', 'Họa sĩ', 'Phi hành gia', 'Cầu thủ bóng đá|Cầu thủ',
        'Nha sĩ', 'Y tá', 'Thợ điện', 'Thợ xây', 'Ảo thuật gia', 'Streamer', 'YouTuber', 'Bảo vệ', 'Bồi bàn|Phục vụ',
        'Kế toán', 'Nhiếp ảnh gia|Thợ chụp ảnh', 'Tiếp viên hàng không', 'DJ', 'Hướng dẫn viên du lịch',
        'Nhà khoa học', 'Thám tử', 'Cướp biển|Hải tặc', 'Vua', 'Công chúa', 'Bác sĩ thú y', 'Thợ sửa xe',
        'Người mẫu', 'Lao công', 'Bộ đội|Quân nhân', 'MC|Người dẫn chương trình', 'Thợ may', 'Dược sĩ',
        'Kiến trúc sư', 'Thủ môn', 'Trọng tài',
      ],
    },
    thing: {
      name: '📦 Đồ vật',
      items: [
        'Điện thoại', 'Bàn chải đánh răng', 'Tủ lạnh', 'Cái ô|Ô|Dù', 'Máy tính|Laptop', 'Đồng hồ', 'Cái ghế|Ghế',
        'Cái gối|Gối', 'Kính mắt|Kính', 'Chìa khóa', 'Xe đạp', 'Xe máy', 'Máy bay', 'Nồi cơm điện', 'Quạt máy|Quạt',
        'Tivi|TV', 'Bút bi', 'Cái kéo|Kéo', 'Cái gương|Gương', 'Bóng đèn', 'Ví tiền|Ví', 'Đôi giày|Giày',
        'Mũ bảo hiểm', 'Ba lô|Balo', 'Cái thìa|Thìa|Muỗng', 'Đôi đũa|Đũa', 'Cái bát|Bát|Chén', 'Cái chảo|Chảo',
        'Máy giặt', 'Điều hòa|Máy lạnh', 'Remote|Điều khiển', 'Sạc điện thoại|Cục sạc', 'Tai nghe', 'Quả bóng đá|Bóng đá',
        'Đàn guitar|Guitar', 'Cây nến|Nến', 'Khẩu trang', 'Bàn phím', 'Chuột máy tính', 'Ô tô|Xe hơi',
        'Bồn cầu|Toilet', 'Giấy vệ sinh', 'Cái chổi|Chổi', 'Máy sấy tóc', 'Bàn là|Bàn ủi', 'Cái lược|Lược',
        'Kem đánh răng', 'Ổ khóa', 'Thang máy', 'Lò vi sóng',
      ],
    },
    food: {
      name: '🍜 Đồ ăn & uống',
      items: [
        'Phở', 'Bánh mì', 'Bún chả', 'Cơm tấm', 'Trà sữa', 'Pizza', 'Hamburger|Bánh hamburger', 'Sushi', 'Kem',
        'Bánh chưng', 'Nem rán|Chả giò', 'Gỏi cuốn', 'Mì tôm|Mì gói', 'Xôi', 'Bánh xèo', 'Sầu riêng', 'Quả xoài|Xoài',
        'Dưa hấu', 'Quả chuối|Chuối', 'Quả táo|Táo', 'Cà phê sữa đá|Cà phê', 'Trứng vịt lộn|Hột vịt lộn', 'Lẩu',
        'Bánh cuốn', 'Chè', 'Sữa chua', 'Bỏng ngô|Bắp rang', 'Khoai tây chiên', 'Gà rán', 'Mì Ý|Spaghetti',
        'Bánh flan|Caramen', 'Kẹo bông gòn|Kẹo bông', 'Socola|Chocolate', 'Nước mía', 'Bún bò Huế|Bún bò', 'Hủ tiếu',
        'Bánh bao', 'Ốc', 'Cá viên chiên', 'Bánh tráng trộn', 'Trà đá', 'Bia', 'Coca Cola|Coca', 'Bánh trung thu',
        'Bánh kem|Bánh sinh nhật', 'Cơm rang|Cơm chiên', 'Thịt kho tàu|Thịt kho', 'Chả cá', 'Bánh bèo', 'Mì cay',
      ],
    },
  };
  CATEGORIES.mix = {
    name: '🎲 Trộn tất cả',
    items: Object.values(CATEGORIES).flatMap((c) => c.items),
  };

  const DATA = { CATEGORIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.WHOAMI_DATA = DATA;
})(this);
