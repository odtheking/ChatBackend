import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket } from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { JwtService } from "@nestjs/jwt"
import { ChatsService } from "../chats/chat.service"
import { UsersService } from "../users/users.service"
import { Logger } from '@nestjs/common'
import {Types} from "mongoose"

@WebSocketGateway({cors: {origin: '*'}})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(EventsGateway.name)
    private readonly userSockets = new Map<string, Socket>()

    @WebSocketServer()
    server: Server

    constructor(
        private readonly chatsService: ChatsService,
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) {}

    async handleConnection(@ConnectedSocket() client: Socket) {
        const token = client.handshake.auth.token

        if (!token) {
            this.logger.warn('Client attempted connection without token')
            client.disconnect()
            return
        }

        try {
            const decoded = await this.jwtService.verifyAsync(token)
            const userId = decoded.sub as Types.ObjectId

            client.data.userId = userId
            this.userSockets.set(userId.toString(), client)

            this.logger.log(`User ${userId} connected`)

            await this.sendChatsToUser(userId, client)
        } catch (error) {
            this.logger.warn('Invalid token provided during connection')
            client.disconnect()
        }
    }

    handleDisconnect(@ConnectedSocket() client: Socket) {
        if (!client.data.userId) return
        this.userSockets.delete(client.data.userId.toString())
        this.logger.log(`User ${client.data.userId} disconnected`)
    }

    private async sendChatsToUser(userId: Types.ObjectId, socket: Socket) {
        const chats = await this.chatsService.findByUser(userId)

        const formattedChats = await Promise.all(chats.map(async (chat) => {
            const members = await Promise.all(chat.users.map(async (user) => {
                return (await this.usersService.findById(user._id))?.name
            }))
            return { chatId: chat._id, members: members}
        }))

        socket.emit('chatUpdate', formattedChats)
        this.logger.log(`Sent ${formattedChats.length} chats to user ${userId}`)
    }

    private async notifyUsersOfChatUpdate(userIds: Types.ObjectId[]): Promise<void> {
        for (const userId of userIds) {
            const userSocket = this.userSockets.get(userId.toString())
            if (userSocket) await this.sendChatsToUser(userId, userSocket)
        }
    }

    @SubscribeMessage('createChat')
    async handleCreateChat(@MessageBody() data: { users: string[] }, @ConnectedSocket() client: Socket): Promise<void> {
        if (!data?.users || !Array.isArray(data.users) || data.users.length === 0) {
            this.logger.warn('Invalid create chat data received')
            client.emit('chatCreateError', { message: 'Users array is required' })
            return
        }

        const userId = client.data.userId as Types.ObjectId
        if (!userId) {
            this.logger.warn('Unauthorized create chat attempt')
            client.disconnect()
            return
        }

        const currentUser = await this.usersService.findById(userId)
        const currentUsername = currentUser?.name || 'Unknown'

        if (!data.users.includes(currentUsername)) data.users.push(currentUsername)
        const chat = await this.chatsService.create(data.users)

        this.logger.log(`Chat ${chat._id} created by user ${userId}`)
        await this.notifyUsersOfChatUpdate(chat.users.map(u => u._id))
        client.emit('chatCreated', { id: chat._id, users: chat.users })
    }

    @SubscribeMessage('getChatMessages')
    async handleGetChatMessages(@MessageBody() data: { chatId: string }, @ConnectedSocket() client: Socket): Promise<void> {
        if (!data?.chatId) {
            this.logger.warn('Invalid get messages data received')
            client.emit('messagesError', { message: 'Chat ID is required' })
            return
        }

        const userId = client.data.userId as Types.ObjectId
        if (!userId) {
            this.logger.warn('Unauthorized get messages attempt')
            client.disconnect()
            return
        }

        const chat = await this.chatsService.findById(new Types.ObjectId(data.chatId))

        if (!chat) {
            this.logger.warn(`Chat ${data.chatId} not found`)
            client.emit('messagesError', { message: 'Chat not found' })
            return
        }

        if (!chat.users.some(user => user._id.toString() === userId.toString())) {
            this.logger.warn(`User ${userId} attempted to access unauthorized chat ${data.chatId}`)
            client.emit('messagesError', { message: 'Access denied to this chat' })
            return
        }

        const messages = await this.chatsService.getMessages(new Types.ObjectId(data.chatId))

        const formattedMessages = messages.map(message => ({
            id: message._id,
            content: message.content,
            sender: (message.sender as any).name,
            timestamp: (message as any).createdAt,
            chatId: message.chat.toString()
        }))

        client.emit('chatMessages', formattedMessages)
        this.logger.log(`Sent ${formattedMessages.length} messages from chat ${data.chatId} to user ${userId}`)
    }

    @SubscribeMessage('deleteChat')
    async handleDeleteChat(@MessageBody() data: { chatId: string }, @ConnectedSocket() client: Socket): Promise<void> {
        if (!data?.chatId) {
            this.logger.warn('Invalid delete chat data received')
            client.emit('chatDeleteError', { message: 'Invalid request data' })
            return
        }

        const userId = client.data.userId as Types.ObjectId
        if (!userId) {
            this.logger.warn('Unauthorized delete chat attempt')
            client.disconnect()
            return
        }

        const deletedChat = await this.chatsService.deleteChat(new Types.ObjectId(data.chatId), userId)

        this.logger.log(`Chat ${data.chatId} deleted by user ${userId}`)

        await this.notifyUsersOfChatUpdate(deletedChat.users)
        this.logger.log(`Notified users of deleted chat ${data.chatId}`)
    }

    @SubscribeMessage('msgToServer')
    async handleMessage(@MessageBody() data: { chatId: string, message: string }, @ConnectedSocket() client: Socket): Promise<void> {
        if (!data?.chatId || !data?.message) {
            this.logger.warn('Invalid message data received')
            return
        }

        const trimmedMessage = data.message.trim()

        if (trimmedMessage.length === 0 || trimmedMessage.length > 1500) {
            this.logger.warn('Invalid message length')
            return
        }

        const userId = client.data.userId as Types.ObjectId
        if (!userId) {
            this.logger.warn('Unauthorized message attempt')
            client.disconnect()
            return
        }

        const chat = await this.chatsService.findById(new Types.ObjectId(data.chatId))

        if (!chat) {
            this.logger.warn(`Chat ${data.chatId} not found`)
            return
        }

        if (!chat.users.some(u => u._id.toString() === userId.toString())) {
            this.logger.warn(`User ${userId} attempted to send message to unauthorized chat ${data.chatId}`)
            return
        }

        const savedMessage = await this.chatsService.saveMessage(new Types.ObjectId(data.chatId), userId, trimmedMessage)

        if (!savedMessage) {
            this.logger.error('Failed to save message')
            return
        }

        const messageForClient = {
            id: savedMessage._id,
            content: savedMessage.content,
            sender: (savedMessage.sender as any).name,
            timestamp: (savedMessage as any).createdAt,
            chatId: savedMessage.chat.toString()
        }

        this.logger.log(`Message saved in chat ${data.chatId} by user ${userId}`)
        for (const user of chat.users) {
            const userSocket = this.userSockets.get(user._id.toString())
            if (userSocket) userSocket.emit('msgToClient', messageForClient)
        }
    }
}