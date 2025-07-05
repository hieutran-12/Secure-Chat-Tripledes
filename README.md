# Secure-Chat-Tripledes

# 💬 Ứng dụng Chat Bảo Mật với TripleDES, RSA và SHA-256 🔐

Đây là một ứng dụng **chat bảo mật chạy trên trình duyệt**, sử dụng các kỹ thuật mã hóa hiện đại để bảo vệ nội dung tin nhắn:

- **TripleDES (CBC)** để mã hóa nội dung
- **RSA 2048-bit** để trao đổi khóa và ký số
- **SHA-256** để kiểm tra toàn vẹn nội dung

Ứng dụng giao tiếp qua **WebSocket**, với server trung gian chỉ chuyển tiếp tin nhắn **đã mã hóa**, không giải mã hoặc đọc nội dung.

---

## 🚀 Tính năng chính

- Mã hóa đầu cuối (End-to-End Encryption)
- Giao diện đơn giản, hoạt động trực tiếp trên trình duyệt
- Mỗi người dùng tạo cặp khóa RSA riêng
- Ký số và xác thực người gửi tin
- Kiểm tra toàn vẹn nội dung với SHA-256
- Server không giữ khóa riêng, không thể đọc nội dung

---

## 🛠️ Công nghệ sử dụng

### Frontend (Client)

- HTML + CSS + JavaScript
- Thư viện:
  - [`CryptoJS`](https://cdnjs.com/libraries/crypto-js) – mã hóa TripleDES, SHA-256
  - [`JSEncrypt`](https://cdnjs.com/libraries/jsencrypt) – mã hóa/giải mã RSA

### Backend (Server)

- Python
- Flask + WebSocket (Socket.IO hoặc WebSocket thuần)

---

## 🔐 Quy trình gửi tin nhắn bảo mật

1. Người dùng tạo cặp khóa RSA (Public + Private)
2. Gửi public key cho server để chia sẻ với các client khác
3. Khi gửi tin:
   - Tạo một khóa TripleDES ngẫu nhiên
   - Mã hóa nội dung bằng TripleDES
   - Mã hóa khóa TripleDES bằng RSA public key của người nhận
   - Tạo SHA-256 hash nội dung và ký số bằng RSA private key
4. Gửi gói tin: `ciphertext`, `encrypted key`, `signature`
5. Người nhận:
   - Giải mã khóa TripleDES bằng RSA private key
   - Giải mã nội dung
   - Kiểm tra chữ ký và hash để xác minh

---

## 🗂️ Cấu trúc thư mục

📦 Secure-Chat-Tripledes
├── client/ <br>
│ ├── index.html # Trang nhập tên người dùng<br>
│ ├── chat.html # Giao diện chat<br>
│ └── script.js # Xử lý mã hóa + giao tiếp WebSocket<br>
├── server/<br>
│ └── server.py # Server trung gian chuyển tiếp tin nhắn<br>
└── README.md<br>

## ▶️ Cách chạy ứng dụng

1. **Chạy server**:
   ```bash
   python server/server.py
   ```
2. **Chạy file index.html** → mở client/index.html (có thể mở từ 2 tab khác nhau)

3. **Vào brower**Nhập tên người dùng, bắt đầu chat an toàn!
