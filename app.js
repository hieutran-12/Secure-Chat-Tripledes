// ===== BIẾN TOÀN CỤC =====
let ws = null; // WebSocket connection tới server
let username = ""; // Tên người dùng hiện tại
let users = {}; // Danh sách người dùng khác (kèm public key RSA)
let des3Keys = {}; // Danh sách các khóa 3DES (mã hóa nội dung tin nhắn)
let rsa = new JSEncrypt({ default_key_size: 2048 }); // Tạo cặp khóa RSA 2048 bit

// ===== HÀM THAM GIA PHÒNG CHAT =====
function joinChat() {
  username = document.getElementById("username").value.trim();
  if (!username) {
    alert("Please enter a username");
    return;
  }

  ws = new WebSocket("ws://localhost:5000"); // Kết nối tới WebSocket server

  // Khi kết nối thành công, gửi tin "hello" chứa tên và public key
  ws.onopen = () => {
    console.log("WebSocket connected");
    ws.send(
      JSON.stringify({
        type: "hello",
        user: username,
        public_key: rsa.getPublicKey(), // Gửi public key để người khác mã hóa key
      })
    );
  };

  // Nhận và xử lý tin nhắn từ server
  ws.onmessage = (event) => {
    console.log("Received:", event.data);
    try {
      const data = JSON.parse(event.data);
      if (data.type === "ready") {
        // Server xác nhận đã đăng nhập thành công
        document.getElementById("join-section").style.display = "none";
        document.getElementById("chat-section").style.display = "flex";
        document.getElementById("current-user").textContent = username;
      } else if (data.type === "users") {
        // Danh sách người dùng mới từ server
        users = data.users || {};
        updateUserList(Object.keys(users));
      } else if (data.type === "key_exchange") {
        handleKeyExchange(data); // Nhận khóa 3DES từ người khác
      } else if (data.type === "ack") {
        appendMessage("Message delivered", "received");
      } else if (data.type === "nack") {
        appendMessage(`Error: ${data.error}`, "error");
      } else if (data.type === "message") {
        handleMessage(data); // Xử lý tin nhắn đến
      } else if (data.error) {
        appendMessage(`Error: ${data.error}`, "error");
        if (data.error.includes("Username") || data.error.includes("Invalid")) {
          ws.close();
        }
      }
    } catch (e) {
      console.error("Error parsing message:", e);
      appendMessage("Error processing server message", "error");
    }
  };

  // Kết nối đóng => hiện lại form đăng nhập
  ws.onclose = () => {
    console.log("WebSocket disconnected");
    appendMessage("Disconnected from server", "error");
    document.getElementById("join-section").style.display = "block";
    document.getElementById("chat-section").style.display = "none";
    updateUserList([]);
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    appendMessage("Connection error", "error");
  };
}

// ===== TRAO ĐỔI KHÓA 3DES =====
function sendKeyExchange(to) {
  if (!users[to]) {
    appendMessage(`Error: User ${to} not found`, "error");
    return;
  }
  const id = username; // ID là tên người gửi
  const timestamp = Date.now().toString(); // Đánh dấu thời gian gửi
  const info = `${id}:${timestamp}`; // Nội dung sẽ được ký

  // Ký nội dung info bằng private key
  const signer = new JSEncrypt();
  signer.setPrivateKey(rsa.getPrivateKey());
  const signedInfo = signer.sign(info, CryptoJS.SHA256, "sha256");

  // Tạo khóa 3DES ngẫu nhiên, mã hóa bằng RSA của người nhận
  const des3Key = CryptoJS.lib.WordArray.random(24).toString(
    CryptoJS.enc.Base64
  );
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(users[to]);
  const encrypted3desKey = encryptor.encrypt(des3Key);

  // Gửi gói key exchange
  ws.send(
    JSON.stringify({
      type: "key_exchange",
      to: to,
      from: username,
      id: id,
      timestamp: timestamp,
      signed_info: signedInfo,
      encrypted_3des_key: encrypted3desKey,
    })
  );

  console.log(`Sent key exchange to ${to}`);
  appendMessage(`Key exchange initiated with ${to}`, "received");
  des3Keys[to] = des3Key; // Lưu khóa tạm
}

// ===== GỬI TIN NHẮN BẢO MẬT =====
function sendMessage() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    appendMessage("Not connected to server", "error");
    return;
  }
  const recipient = document.getElementById("recipient").value.trim();
  const message = document.getElementById("message").value.trim();
  if (!recipient || !message) {
    alert("Please enter recipient and message");
    return;
  }
  // Nếu chưa có khóa với người nhận => trao đổi khóa
  if (!des3Keys[recipient]) {
    appendMessage(
      `No key for ${recipient}. Initiating key exchange...`,
      "received"
    );
    sendKeyExchange(recipient);
    setTimeout(() => {
      if (des3Keys[recipient]) sendMessage();
      else
        appendMessage(
          `Key exchange with ${recipient} failed or not completed`,
          "error"
        );
    }, 2000);
    return;
  }
  try {
    const iv = CryptoJS.lib.WordArray.random(8); // Tạo IV 64-bit
    const cipher = CryptoJS.TripleDES.encrypt(
      message,
      CryptoJS.enc.Base64.parse(des3Keys[recipient]),
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    const ivBase64 = iv.toString(CryptoJS.enc.Base64);
    const cipherBase64 = cipher.toString();
    const hash = CryptoJS.SHA256(ivBase64 + cipherBase64).toString();

    const signer = new JSEncrypt();
    signer.setPrivateKey(rsa.getPrivateKey());
    const sig = signer.sign(ivBase64 + cipherBase64, CryptoJS.SHA256, "sha256");

    ws.send(
      JSON.stringify({
        type: "message",
        to: recipient,
        from: username,
        iv: ivBase64,
        cipher: cipherBase64,
        hash: hash,
        sig: sig,
      })
    );

    console.log(`Sent message to ${recipient}: ${message}`);
    appendMessage(`To ${recipient}: ${message}`, "sent");
    document.getElementById("message").value = "";
  } catch (e) {
    appendMessage(
      `Error sending message to ${recipient}: ${e.message}`,
      "error"
    );
    console.error("Send message error:", e);
  }
}

// ===== XỬ LÝ NHẬN KHÓA 3DES =====
function handleKeyExchange(data) {
  const from = data.from;
  const id = data.id;
  const timestamp = data.timestamp;
  const signedInfo = data.signed_info;
  const encrypted3desKey = data.encrypted_3des_key;
  const info = `${id}:${timestamp}`;

  // Kiểm tra chữ ký bằng public key của người gửi
  const verifier = new JSEncrypt();
  verifier.setPublicKey(users[from] || "");
  if (!verifier.verify(info, signedInfo, CryptoJS.SHA256)) {
    appendMessage(
      `Error: Invalid key exchange signature from ${from}`,
      "error"
    );
    return;
  }

  try {
    const decryptor = new JSEncrypt();
    decryptor.setPrivateKey(rsa.getPrivateKey());
    des3Keys[from] = decryptor.decrypt(encrypted3desKey);
    appendMessage(`Key exchange with ${from} successful`, "received");
    console.log(`Received key from ${from}`);
    ws.send(
      JSON.stringify({
        type: "key_exchange_ack",
        to: from,
        from: username,
      })
    );
  } catch (e) {
    appendMessage(`Error decrypting key from ${from}: ${e.message}`, "error");
    console.error("Key decryption error:", e);
  }
}

// ===== XỬ LÝ TIN NHẮN ĐẾN =====
function handleMessage(data) {
  const from = data.from;
  const iv = data.iv;
  const cipher = data.cipher;
  const hash = data.hash;
  const sig = data.sig;

  if (!des3Keys[from]) {
    appendMessage(
      `Error: No key for ${from}. Please initiate key exchange.`,
      "error"
    );
    ws.send(
      JSON.stringify({
        type: "nack",
        to: from,
        from: username,
        error: "No shared key!",
      })
    );
    return;
  }

  const verifier = new JSEncrypt();
  verifier.setPublicKey(users[from] || "");
  if (!verifier.verify(iv + cipher, sig, CryptoJS.SHA256)) {
    appendMessage(`Error: Invalid signature from ${from}`, "error");
    ws.send(
      JSON.stringify({
        type: "nack",
        to: from,
        from: username,
        error: "Message Integrity Compromised!",
      })
    );
    return;
  }

  const computedHash = CryptoJS.SHA256(iv + cipher).toString();
  if (computedHash !== hash) {
    appendMessage(`Error: Hash mismatch from ${from}`, "error");
    ws.send(
      JSON.stringify({
        type: "nack",
        to: from,
        from: username,
        error: "Message Integrity Compromised!",
      })
    );
    return;
  }

  try {
    const plaintext = CryptoJS.TripleDES.decrypt(
      cipher,
      CryptoJS.enc.Base64.parse(des3Keys[from]),
      {
        iv: CryptoJS.enc.Base64.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    ).toString(CryptoJS.enc.Utf8);
    if (!plaintext) throw new Error("Decryption failed");
    appendMessage(`From ${from}: ${plaintext}`, "received");
    ws.send(JSON.stringify({ type: "ack", to: from, from: username }));
    console.log(`Received message from ${from}: ${plaintext}`);
  } catch (e) {
    appendMessage(
      `Error processing message from ${from}: ${e.message}`,
      "error"
    );
    ws.send(
      JSON.stringify({
        type: "nack",
        to: from,
        from: username,
        error: "Message Integrity Compromised!",
      })
    );
    console.error("Message processing error:", e);
  }
}

// ===== HIỂN THỊ TIN NHẮN LÊN GIAO DIỆN =====
function appendMessage(text, type) {
  const chatBox = document.getElementById("chat-box");
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ===== CẬP NHẬT DANH SÁCH NGƯỜI DÙNG ONLINE =====
function updateUserList(userList) {
  const userListDiv = document.getElementById("users");
  userListDiv.innerHTML = "";
  userList.forEach((user) => {
    if (user !== username) {
      const div = document.createElement("div");
      div.className = "user";
      div.textContent = user;
      div.onclick = () => {
        document.getElementById("recipient").value = user;
        if (!des3Keys[user]) {
          appendMessage(`Initiating key exchange with ${user}...`, "received");
          sendKeyExchange(user);
        }
      };
      userListDiv.appendChild(div);
    }
  });
}
