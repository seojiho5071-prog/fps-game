const http = require("http");
const server = http.createServer();
const io = require("socket.io")(server, {
  cors: { origin: "*" } // 모든 곳에서 접속 허용
});

let players = {};

io.on("connection", (socket) => {
  console.log("새로운 플레이어 접속:", socket.id);

  // 초기 상태 설정
  players[socket.id] = { x: 0, z: 0, hp: 100 };

  // 이동 데이터 수신
  socket.on("move", (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].z = data.z;
    }
  });

  // 사격 판정 (PVP)
  socket.on("shoot", (data) => {
    for (let id in players) {
      if (id !== socket.id) {
        const dx = players[id].x - data.x;
        const dz = players[id].z - data.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // 거리 2 이내면 히트!
        if (dist < 2) {
          players[id].hp -= 20;
          io.to(id).emit("hit", { dmg: 20 });
          console.log(`${id}가 총에 맞음! 남은 HP: ${players[id].hp}`);
        }
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("접속 종료:", socket.id);
    delete players[socket.id];
  });
});

// 모든 클라이언트에게 0.05초마다 상태 전송
setInterval(() => {
  io.emit("state", players);
}, 50);

// 💡 중요: 외부 서버(Render 등)에서 지정해주는 포트를 사용하도록 설정
const PORT = process.env.PORT || 3001; 
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 돌아가고 있습니다!`);
});