import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { Message } from '../../modules/messaging/message.model';
import { Conversation } from '../../modules/messaging/conversation.model';

export class SocketService {
  private static io: Server;

  static init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*', // Adjust for production
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      socket.on('join_conversation', (conversationId: string) => {
        socket.join(conversationId);
        console.log(`User joined conversation: ${conversationId}`);
      });

      socket.on('send_message', async (data: { conversationId: string, senderId: string, content: string }) => {
        try {
          const message = await Message.create(data);
          
          // Update last message in conversation
          await Conversation.update(
            { lastMessage: data.content, lastMessageAt: new Date() },
            { where: { id: data.conversationId } }
          );

          // Broadcast to all users in the conversation
          this.io.to(data.conversationId).emit('new_message', message);
        } catch (error) {
          console.error('Error sending message via socket:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
      });
    });
  }

  static getIO() {
    if (!this.io) {
      throw new Error('Socket.io not initialized');
    }
    return this.io;
  }
}
