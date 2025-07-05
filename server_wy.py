import asyncio
import websockets
import json
import base64
import time

# ✅ Lưu thông tin client: username -> {'ws': WebSocket, 'pubkey': Public RSA key}
clients = {}

# 🔄 Gửi danh sách người dùng hiện tại đến tất cả client
async def broadcast_users():
    if clients:
        user_list = {username: client['pubkey'] for username, client in clients.items()}
        message = json.dumps({"type": "users", "users": user_list})
        for client in clients.values():
            try:
                await client['ws'].send(message)
            except:
                pass  # Có thể client đã mất kết nối

# 🧠 Hàm xử lý cho mỗi kết nối mới từ client
async def handler(websocket):
    username = None  # Lưu lại username để xóa sau nếu client rời đi

    try:
        # 📥 Nhận gói tin đầu tiên (hello) từ client
        raw = await websocket.recv()
        print(f"[DEBUG] Raw data: {raw}")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            await websocket.send(json.dumps({"error": "Invalid JSON"}))
            return

        # ✅ Kiểm tra gói tin hello hợp lệ
        if data.get("type") == "hello" and "user" in data and "public_key" in data:
            username = data["user"]

            # ❌ Kiểm tra username trùng
            if username in clients:
                await websocket.send(json.dumps({"error": "Username already taken"}))
                return

            # ✅ Lưu client mới
            clients[username] = {'ws': websocket, 'pubkey': data["public_key"]}
            print(f"[+] {username} connected")

            # Gửi xác nhận và danh sách người dùng
            await websocket.send(json.dumps({"type": "ready"}))
            await broadcast_users()
        else:
            await websocket.send(json.dumps({"error": "Invalid hello message"}))
            return

        # 📡 Vòng lặp nhận tin nhắn từ client sau khi đã xác thực
        async for message in websocket:
            try:
                msg = json.loads(message)
                msg_type = msg.get("type")

                # 🎯 Các loại tin được hỗ trợ
                if msg_type in ["key_exchange", "message", "ack", "nack", "key_exchange_ack"]:
                    to = msg.get("to")
                    if to not in clients:
                        await websocket.send(json.dumps({"error": f"Target {to} not connected"}))
                        print(f"[!] Target {to} not connected")
                        continue

                    # 🔁 Chuyển tiếp tin nhắn đến đúng client đích
                    await clients[to]['ws'].send(message)
                    print(f"[>] Forwarded {msg_type} from {username} to {to}")

                    # ✅ Gửi lại ack nếu là tin nhắn loại "message"
                    if msg_type == "message":
                        await websocket.send(json.dumps({"type": "ack"}))
                else:
                    await websocket.send(json.dumps({"error": "Invalid message type"}))
            except json.JSONDecodeError:
                await websocket.send(json.dumps({"error": "Invalid JSON"}))
                print("[!] Invalid JSON received")

    except Exception as e:
        print(f"[!] Error: {e}")

    finally:
        # 👋 Khi client rời đi hoặc mất kết nối
        if username:
            del clients[username]
            print(f"[-] {username} disconnected")
            await broadcast_users()
        await websocket.close()

# 🚀 Chạy server WebSocket trên cổng 5000
async def main():
    async with websockets.serve(handler, "0.0.0.0", 5000):
        print("[🌐] WebSocket server listening on ws://0.0.0.0:5000")
        await asyncio.Future()  # Giữ cho server chạy mãi

if __name__ == "__main__":
    asyncio.run(main())
