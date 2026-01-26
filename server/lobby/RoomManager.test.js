/**
 * RoomManager 单元测试 - 聊天功能
 */

const RoomManager = require('./RoomManager');

// Mock Socket.IO
const createMockIO = () => {
    const rooms = new Map();
    return {
        to: jest.fn((room) => ({
            emit: jest.fn((event, data) => {
                if (!rooms.has(room)) {
                    rooms.set(room, []);
                }
                rooms.get(room).push({ event, data });
            })
        })),
        _rooms: rooms
    };
};

// Mock Socket
const createMockSocket = (id, username) => ({
    id: `socket_${id}`,
    odify: `user_${id}`,
    get odify() { return this.userId; },
    set odify(v) { this.userId = v; },
    userId: `user_${id}`,
    username: username || `Player${id}`,
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn()
});

describe('RoomManager', () => {
    let roomManager;
    let mockIO;

    beforeEach(() => {
        mockIO = createMockIO();
        roomManager = new RoomManager(mockIO, null);
    });

    describe('handleChat - 聊天消息处理', () => {
        let socket1, socket2;
        let roomId;

        beforeEach(() => {
            socket1 = createMockSocket(1, 'Player1');
            socket2 = createMockSocket(2, 'Player2');

            // 创建房间并加入玩家
            roomManager.createRoom(socket1, { name: 'Test Room' });
            roomId = roomManager.playerRooms.get(socket1.userId);
            roomManager.joinRoom(socket2, roomId);
        });

        test('应该正确广播聊天消息', () => {
            roomManager.handleChat(socket1, 'Hello World');

            // 检查是否调用了 io.to
            expect(mockIO.to).toHaveBeenCalledWith(`room:${roomId}`);
        });

        test('消息应该包含正确的发送者信息', () => {
            roomManager.handleChat(socket1, 'Test message');

            const calls = mockIO.to.mock.results;
            const lastCall = calls[calls.length - 1];
            const emitCall = lastCall.value.emit.mock.calls.find(c => c[0] === 'roomChat');

            expect(emitCall).toBeDefined();
            expect(emitCall[1].username).toBe('Player1');
            expect(emitCall[1].message).toBe('Test message');
            expect(emitCall[1].playerId).toBe(socket1.userId);
            expect(emitCall[1].timestamp).toBeDefined();
        });

        test('应该限制消息长度为200字符', () => {
            const longMessage = 'a'.repeat(300);
            roomManager.handleChat(socket1, longMessage);

            const calls = mockIO.to.mock.results;
            const lastCall = calls[calls.length - 1];
            const emitCall = lastCall.value.emit.mock.calls.find(c => c[0] === 'roomChat');

            expect(emitCall[1].message.length).toBe(200);
        });

        test('应该忽略空消息', () => {
            const initialCallCount = mockIO.to.mock.calls.length;

            roomManager.handleChat(socket1, '');
            roomManager.handleChat(socket1, '   ');

            // 不应该有新的广播
            const chatCalls = mockIO.to.mock.results.filter(r => {
                const emitCalls = r.value.emit.mock.calls;
                return emitCalls.some(c => c[0] === 'roomChat');
            });

            // 空消息不应该广播
            expect(chatCalls.length).toBe(0);
        });

        test('应该忽略null/undefined消息', () => {
            // 这些调用不应该抛出错误
            expect(() => roomManager.handleChat(socket1, null)).not.toThrow();
            expect(() => roomManager.handleChat(socket1, undefined)).not.toThrow();
        });

        test('应该忽略非字符串消息', () => {
            expect(() => roomManager.handleChat(socket1, 123)).not.toThrow();
            expect(() => roomManager.handleChat(socket1, { text: 'hello' })).not.toThrow();
            expect(() => roomManager.handleChat(socket1, ['hello'])).not.toThrow();
        });

        test('不在房间内的玩家不能发送消息', () => {
            const outsideSocket = createMockSocket(99, 'Outsider');
            const initialCallCount = mockIO.to.mock.calls.length;

            roomManager.handleChat(outsideSocket, 'Hello');

            // 调用次数不应增加（没有roomChat广播）
            const newCallCount = mockIO.to.mock.calls.length;
            expect(newCallCount).toBe(initialCallCount);
        });

        test('消息应该包含时间戳', () => {
            const before = Date.now();
            roomManager.handleChat(socket1, 'Test');
            const after = Date.now();

            const calls = mockIO.to.mock.results;
            const lastCall = calls[calls.length - 1];
            const emitCall = lastCall.value.emit.mock.calls.find(c => c[0] === 'roomChat');

            expect(emitCall[1].timestamp).toBeGreaterThanOrEqual(before);
            expect(emitCall[1].timestamp).toBeLessThanOrEqual(after);
        });

        test('应该清理消息两端的空白', () => {
            roomManager.handleChat(socket1, '  Hello World  ');

            const calls = mockIO.to.mock.results;
            const lastCall = calls[calls.length - 1];
            const emitCall = lastCall.value.emit.mock.calls.find(c => c[0] === 'roomChat');

            expect(emitCall[1].message).toBe('Hello World');
        });
    });

    describe('房间基本操作', () => {
        test('创建房间', () => {
            const socket = createMockSocket(1, 'Player1');
            roomManager.createRoom(socket, { name: 'Test Room' });

            const roomId = roomManager.playerRooms.get(socket.userId);
            expect(roomId).toBeDefined();

            const room = roomManager.rooms.get(roomId);
            expect(room).toBeDefined();
            expect(room.name).toBe('Test Room');
        });

        test('加入房间', () => {
            const socket1 = createMockSocket(1, 'Player1');
            const socket2 = createMockSocket(2, 'Player2');

            roomManager.createRoom(socket1, { name: 'Test Room' });
            const roomId = roomManager.playerRooms.get(socket1.userId);

            const result = roomManager.joinRoom(socket2, roomId);
            expect(result).toBe(true);

            const room = roomManager.rooms.get(roomId);
            expect(room.players.length).toBe(2);
        });

        test('离开房间', () => {
            const socket1 = createMockSocket(1, 'Player1');
            const socket2 = createMockSocket(2, 'Player2');

            roomManager.createRoom(socket1, { name: 'Test Room' });
            const roomId = roomManager.playerRooms.get(socket1.userId);
            roomManager.joinRoom(socket2, roomId);

            roomManager.leaveRoom(socket2);

            const room = roomManager.rooms.get(roomId);
            expect(room.players.length).toBe(1);
            expect(roomManager.playerRooms.has(socket2.userId)).toBe(false);
        });
    });
});
